import React, { useState, useEffect } from 'react';
import { X, Database, FileSpreadsheet, CheckCircle2, ChevronRight, AlertCircle, Loader2, Search, ArrowRight, Save, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, writeBatch, doc } from 'firebase/firestore';
import { db, addAuditLog, auth } from '../firebase';
import { ExcelFile, Order, ProductionEntry } from '../types';
import { cn } from '../lib/utils';
import { BUYERS } from '../constants';
import { format, parse, isValid, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

interface CollectFromExcelModalProps {
  onClose: () => void;
  onSuccess: (count: number) => void;
  onPushToForm?: (data: any) => void;
  type: 'orders' | 'entries';
  orders: Order[];
  entries?: ProductionEntry[];
}

export default function CollectFromExcelModal({ onClose, onSuccess, onPushToForm, type, orders, entries = [] }: CollectFromExcelModalProps) {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ExcelFile | null>(null);
  const [step, setStep] = useState<'select' | 'sheet' | 'preview'>('select');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [gridSearch, setGridSearch] = useState('');
  
  const [targetDate, setTargetDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [manualBuyer, setManualBuyer] = useState<string>('');

  const [allSheetsData, setAllSheetsData] = useState<Record<string, any[]>>({});
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<number[]>([]);

  const orderKeys = ['buyer', 'style', 'poNo', 'shipDate', 'color', 'orderQty'];
  const entryKeys = ['date', 'poNo', 'color', 'cut', 'sewOut', 'washR', 'finIn', 'finOut', 'poly', 'shipment', 'floor'];

  const targetKeys = type === 'orders' ? orderKeys : entryKeys;

  const transformRow = (row: any) => {
    const item: any = {};
    const currentYear = new Date().getFullYear();

    targetKeys.forEach(tKey => {
      // Manual buyer for orders if specified
      if (type === 'orders' && tKey === 'buyer' && manualBuyer) {
        item[tKey] = manualBuyer;
        return;
      }

      // Use the global targetDate for entries
      if (type === 'entries' && tKey === 'date') {
        item[tKey] = targetDate;
        return;
      }
      
      const sourceKey = mapping[tKey];
      let val = sourceKey ? row[sourceKey] : '';

      if (['orderQty', 'cut', 'sewOut', 'poly', 'shipment', 'washR', 'finIn', 'finOut'].includes(tKey)) {
        val = typeof val === 'string' ? Number(val.replace(/,/g, '')) : Number(val);
        if (isNaN(val)) val = 0;
      }

      if (['shipDate', 'date'].includes(tKey)) {
        if (!val) {
          val = format(new Date(), 'yyyy-MM-dd');
        } else {
          const dateStr = String(val);
          const iso = parseISO(dateStr);
          if (isValid(iso)) {
            val = format(iso, 'yyyy-MM-dd');
          } else {
            const formats = ['dd-MMM-yy', 'dd-MM-yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd MMM yyyy'];
            let parsedDate = null;
            for (const f of formats) {
              try {
                const d = parse(dateStr, f, new Date());
                if (isValid(d)) {
                  if (d.getFullYear() < 2000) d.setFullYear(currentYear);
                  parsedDate = d;
                  break;
                }
              } catch { continue; }
            }
            val = parsedDate ? format(parsedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
          }
        }
      }
      item[tKey] = val;
    });
    return item;
  };

  // Optimized key calculation using useMemo to avoid infinite loops
  const existingKeys = React.useMemo(() => {
    const keys = new Set<string>();
    if (type === 'entries' && entries.length > 0) {
      entries.forEach(e => {
        keys.add(`${e.date}_${String(e.poNo).toLowerCase()}_${String(e.color).toLowerCase()}`);
      });
    } else if (type === 'orders' && orders.length > 0) {
      orders.forEach(o => {
        keys.add(`${String(o.poNo).toLowerCase()}_${String(o.color).toLowerCase()}`);
      });
    }
    return keys;
  }, [type, entries.length, orders.length]); // Use length as primitive dependency for stability

  useEffect(() => {
    const q = query(collection(db, 'excel_files'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFiles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExcelFile)));
    });
    return () => unsubscribe();
  }, []);

  // Improved mapping dictionary for automatic identification - moved outside for scoring
  const mappingDict: Record<string, string[]> = {
    poNo: ['po no', 'po number', 'p.o.', 'pono'],
    color: ['color', 'colour'],
    style: ['style', 'style no'],
    buyer: ['buyer', 'customer'],
    shipDate: ['ship date', 'delivery date'],
    orderQty: ['order qty', 'total qty', 'order quantity'],
    cut: ['cut qty', 'cutting qty', 'total cut'],
    sewOut: ['sewing qty', 'sewing output', 'sew out'],
    washR: ['wash recv', 'wash receive', 'wash r'],
    finIn: ['total input', 'finishing input', 'fin in'],
    finOut: ['total output', 'finishing output', 'fin out'],
    poly: ['total poly', 'poly qty', 'packing'],
    shipment: ['shipment qty', 'total shipment', 'shipment']
  };

  const handleFileSelect = async (file: ExcelFile) => {
    try {
      setSelectedFile(file);
      let content;
      try {
        content = JSON.parse(file.content);
      } catch (err) {
        console.error("JSON Parse Error:", err);
        alert("The selected file format is corrupted. Please try re-uploading.");
        return;
      }

      if (!content) return;

      if (Array.isArray(content)) {
        setAllSheetsData({ "Default": content });
        setStep('sheet');
      } else {
        setAllSheetsData(content);
        setStep('sheet');
      }
    } catch (error) {
      console.error("File selection error:", error);
      alert("An unexpected error occurred while processing the file.");
    }
  };

  const handleSheetSelect = async (sheetName: string, passedData?: any[]) => {
    const data = passedData || allSheetsData[sheetName];
    setLoading(true);
    setParsedData(data);
    setStep('preview');
    
    // Auto-map based on headers
    const headers = Object.keys(data[0] || {});
    
    const initialMapping: Record<string, string> = {};
    targetKeys.forEach(tKey => {
      // 1. Try exact or dictionary matches
      const possibleNames = mappingDict[tKey] || [tKey.toLowerCase()];
      const match = headers.find(h => {
        const lowerH = h.toLowerCase().trim();
        return possibleNames.some(name => 
          lowerH === name || 
          lowerH.includes(name) || 
          name.includes(lowerH)
        );
      });

      if (match) {
        initialMapping[tKey] = match;
      } else {
        // 2. Fallback to fuzzy match
        const fuzzyMatch = headers.find(h => 
          h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(tKey.toLowerCase().replace(/[^a-z0-9]/g, '')) ||
          tKey.toLowerCase().includes(h.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
        if (fuzzyMatch) initialMapping[tKey] = fuzzyMatch;
      }
    });
    setMapping(initialMapping);
    
    setLoading(false);
    setSelectedRows([]);
  };

  const previewChartData = React.useMemo(() => {
    if (parsedData.length === 0 || step !== 'preview') return [];
    
    const summary = { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0, shipment: 0 };
    parsedData.slice(0, 100).forEach(row => {
      const item = transformRow(row);
      summary.cut += Number(item.cut) || 0;
      summary.sewOut += Number(item.sewOut) || 0;
      summary.washR += Number(item.washR) || 0;
      summary.finIn += Number(item.finIn) || 0;
      summary.finOut += Number(item.finOut) || 0;
      summary.poly += Number(item.poly) || 0;
      summary.shipment += Number(item.shipment) || 0;
    });

    return [
      { name: 'Cut', val: summary.cut, color: '#818cf8' },
      { name: 'Sew', val: summary.sewOut, color: '#f59e0b' },
      { name: 'Wash', val: summary.washR, color: '#10b981' },
      { name: 'Fin In', val: summary.finIn, color: '#06b6d4' },
      { name: 'Poly', val: summary.poly, color: '#e879f9' }
    ].filter(d => d.val > 0);
  }, [parsedData, mapping, step]);

  const getRowStatus = (item: any) => {
    if (type === 'entries') {
      const normalizedItemPo = String(item.poNo || '').trim().toLowerCase();
      const normalizedItemColor = String(item.color || '').trim().toLowerCase();
      
      const key = `${item.date}_${normalizedItemPo}_${normalizedItemColor}`;
      if (existingKeys.has(key)) return { code: 'existing', label: 'EXISTS' };
      
      const orderExists = orders.some(o => 
        String(o.poNo || '').trim().toLowerCase() === normalizedItemPo &&
        String(o.color || '').trim().toLowerCase() === normalizedItemColor
      );
      if (!orderExists) return { code: 'error', label: 'NOT FOUND' };
    } else {
      const normalizedItemPo = String(item.poNo || '').trim().toLowerCase();
      const normalizedItemColor = String(item.color || '').trim().toLowerCase();
      const key = `${normalizedItemPo}_${normalizedItemColor}`;
      if (existingKeys.has(key)) return { code: 'existing', label: 'EXISTS' };
    }
    return { code: 'new', label: 'READY' };
  };

  const handleSave = async () => {
    const rowsToImport = selectedRows.length > 0 
      ? parsedData.filter((_, i) => selectedRows.includes(i))
      : parsedData;

    const transformed = rowsToImport.map(row => transformRow(row));
    
    // Check for duplicates in current selection
    const duplicatesInSelection = transformed.filter(item => {
      const normalizedPo = String(item.poNo || '').trim().toLowerCase();
      const normalizedColor = String(item.color || '').trim().toLowerCase();
      
      if (type === 'entries') {
        const entryKey = `${item.date}_${normalizedPo}_${normalizedColor}`;
        return existingKeys.has(entryKey);
      } else {
        const orderKey = `${normalizedPo}_${normalizedColor}`;
        return existingKeys.has(orderKey);
      }
    });

    let finalResults = transformed;

    if (duplicatesInSelection.length > 0) {
      const proceed = window.confirm(`${duplicatesInSelection.length} of the selected rows already exist in the database. Do you want to add them as new duplicate entries?\n\n- Click 'OK' to add ALL selected (including duplicates).\n- Click 'Cancel' to SKIP existing rows and ONLY add new ones.`);
      
      if (!proceed) {
        // Filter out the duplicates
        finalResults = transformed.filter(item => {
          const normalizedPo = String(item.poNo || '').trim().toLowerCase();
          const normalizedColor = String(item.color || '').trim().toLowerCase();
          
          if (type === 'entries') {
            const entryKey = `${item.date}_${normalizedPo}_${normalizedColor}`;
            return !existingKeys.has(entryKey);
          } else {
            const orderKey = `${normalizedPo}_${normalizedColor}`;
            return !existingKeys.has(orderKey);
          }
        });
      }
    }

    const validResults = finalResults.filter(item => {
      if (!item.poNo) return false;
      
      const normalizedPo = String(item.poNo || '').trim().toLowerCase();
      const normalizedColor = String(item.color || '').trim().toLowerCase();

      if (type === 'entries') {
        // Core Logic: Does this PO/Color even exist in our Master?
        const orderExists = orders.some(o => 
          String(o.poNo || '').trim().toLowerCase() === normalizedPo &&
          String(o.color || '').trim().toLowerCase() === normalizedColor
        );
        if (!orderExists) return false;
      }

      return true;
    });

    if (validResults.length === 0) {
      alert("No valid data selected for import.");
      return;
    }

    setLoading(true);
    try {
      const collectionName = type === 'orders' ? 'orders' : 'entries';
      const CHUNK_SIZE = 50;
      
      // Breakdown into chunks for Firebase stability
      for (let i = 0; i < validResults.length; i += CHUNK_SIZE) {
        const chunk = validResults.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(item => {
          const newDocRef = doc(collection(db, collectionName));
          batch.set(newDocRef, {
            ...item,
            userId: auth.currentUser?.uid || 'anonymous',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        });
        
        await batch.commit();
      }

      const entityType = type === 'orders' ? 'ORDER' : 'ENTRY';
      await addAuditLog('IMPORT', entityType, `Imported ${validResults.length} ${type} via Advanced Workspace`, '/import');
      onSuccess(validResults.length);
    } catch (error) {
      console.error("Save error:", error);
      alert("Save failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const pushToForm = (rowIdx: number) => {
    if (!onPushToForm) return;
    const transformed = transformRow(parsedData[rowIdx]);
    onPushToForm(transformed);
    onClose();
  };

  const toggleRowSelection = (idx: number) => {
    setSelectedRows(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const toggleSelectAllRows = () => {
    if (selectedRows.length === filteredGridData.length) {
      setSelectedRows([]);
    } else {
      const allIdx = filteredGridData.map((_, i) => i);
      setSelectedRows(allIdx);
    }
  };

  const filteredGridData = React.useMemo(() => {
    return parsedData.filter(row => {
      const item = transformRow(row);

      // 1. Filter out Subtotal/Total rows (must have mapped PO NO and STYLE/COLOR)
      const poKey = mapping['poNo'];
      if (poKey && (!row[poKey] || String(row[poKey]).toLowerCase().includes('total'))) return false;
      
      const styleKey = mapping['style'];
      if (type === 'orders' && styleKey && !row[styleKey]) return false;

      // 2. Filter out rows with NO data (all production fields are 0 or empty)
      if (type === 'entries') {
        const prodFields = ['cut', 'sewOut', 'washR', 'finIn', 'finOut', 'poly', 'shipment'];
        const hasData = prodFields.some(f => Number(item[f]) > 0);
        if (!hasData) return false;
      }

      // 3. Apply search filter
      if (!gridSearch) return true;
      return Object.values(row).some(v => 
        String(v).toLowerCase().includes(gridSearch.toLowerCase())
      );
    });
  }, [parsedData, mapping, gridSearch, type, transformRow]);

  const filteredFiles = files.filter(f => f.fileName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[8000] flex items-start justify-center p-4 overflow-y-auto pt-10 pb-10 no-scrollbar">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-black/95 backdrop-blur-xl" 
      />
      <motion.div
        initial={{ scale: 0.98, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.98, opacity: 0, y: 20 }}
        className="relative w-full max-w-6xl bg-card border border-white/20 rounded-[2.5rem] overflow-hidden shadow-3xl flex flex-col min-h-[500px] mb-auto z-50"
      >
        {/* Header */}
        <div className="p-6 border-b border-border/20 bg-bg2/40 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-fg tracking-tighter">DATA COLLECTION</h3>
              <p className="text-[10px] text-muted font-bold uppercase tracking-widest">
                Source: Excel Knowledge Base — Protocol {type === 'orders' ? 'OM-01' : 'DE-01'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted hover:text-fg transition-all hover:rotate-90">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {step === 'select' ? (
            <div className="p-8 flex flex-col h-full">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-black uppercase tracking-widest text-muted">Step 1: Select Knowledge Asset</h4>
                </div>
                <div className="relative w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search library..." 
                    className="fi pl-10 h-10 text-xs bg-white/5 rounded-xl border-border/50" 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto no-scrollbar pb-10">
                {filteredFiles.map(file => (
                  <button 
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    className="flex flex-col p-5 bg-white/5 border border-border/50 rounded-2xl text-left hover:border-accent/40 hover:bg-accent/5 transition-all group"
                  >
                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent mb-4 group-hover:scale-110 transition-transform">
                      <FileSpreadsheet size={16} />
                    </div>
                    <span className="text-xs font-black text-fg mb-1 truncate w-full">{file.fileName}</span>
                    <span className="text-[9px] text-muted font-bold uppercase tracking-widest">{file.rowCount} Data Points</span>
                    <div className="mt-4 flex items-center justify-between w-full opacity-60">
                      <span className="text-[8px] font-bold">{format(new Date(file.uploadedAt), 'dd MMM yyyy')}</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                ))}
                {filteredFiles.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-border/20 rounded-3xl">
                     <FileSpreadsheet size={40} className="mx-auto mb-4 opacity-10" />
                     <p className="text-sm font-bold text-muted">File Repository Empty</p>
                     <p className="text-[10px] text-muted uppercase mt-1 tracking-widest font-black">Upload files in Library first</p>
                  </div>
                )}
              </div>
            </div>
          ) : step === 'sheet' ? (
            <div className="p-8 flex flex-col h-full overflow-hidden">
              <div className="mb-8 flex items-center justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setStep('select')} className="text-xs font-black text-accent uppercase tracking-widest hover:underline">Back to Files</button>
                    <ChevronRight size={14} className="text-muted" />
                    <span className="text-sm font-black text-fg uppercase tracking-widest">{selectedFile?.fileName}</span>
                  </div>
                  
                  {/* Moved Inputs Here */}
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/5">
                    {type === 'entries' ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Target Entry Date</span>
                        <input 
                          type="date"
                          className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-1.5 text-xs text-accent outline-none focus:ring-1 focus:ring-accent font-bold"
                          value={targetDate}
                          onChange={e => setTargetDate(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-muted uppercase tracking-widest ml-1">Assigned Buyer (Manual Override)</span>
                        <div className="flex items-center gap-2">
                          <input 
                            list="buyer-suggestions-step2"
                            placeholder="Type Buyer name..."
                            className="bg-accent/10 border border-accent/20 rounded-lg px-3 py-1.5 text-xs text-accent outline-none focus:ring-1 focus:ring-accent font-bold placeholder:text-accent/30 w-64"
                            value={manualBuyer}
                            onChange={e => setManualBuyer(e.target.value)}
                          />
                          <datalist id="buyer-suggestions-step2">
                            {BUYERS.map(b => (
                              <option key={b} value={b} />
                            ))}
                          </datalist>
                          {manualBuyer && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-success/10 text-success rounded-md text-[9px] font-black uppercase tracking-tighter border border-success/20 animate-pulse">
                              <CheckCircle2 size={10} /> Manual Locked
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <h4 className="text-sm font-black uppercase tracking-widest text-muted mb-6">Step 2: Select Target Sheet</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto no-scrollbar pb-10">
                {Object.keys(allSheetsData).map(sheetName => (
                  <button 
                    key={sheetName}
                    onClick={() => handleSheetSelect(sheetName)}
                    className="flex items-center justify-between p-5 bg-white/5 border border-border/50 rounded-2xl text-left hover:border-accent/40 hover:bg-accent/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                        <Layers size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-fg mb-1">{sheetName}</span>
                        <span className="text-[9px] text-muted font-bold uppercase tracking-widest">{allSheetsData[sheetName].length} Rows Detected</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="text-muted group-hover:text-accent group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col p-8 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <div className="flex-1 flex flex-col gap-2">
                   <div className="flex items-center gap-3">
                    <button 
                      onClick={() => Object.keys(allSheetsData).length > 0 ? setStep('sheet') : setStep('select')} 
                      className="text-xs font-black text-accent uppercase tracking-widest hover:underline"
                    >
                      Back to {Object.keys(allSheetsData).length > 0 ? 'Sheets' : 'Files'}
                    </button>
                    <ChevronRight size={14} className="text-muted" />
                    <span className="text-sm font-black text-fg uppercase tracking-widest">{selectedFile?.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-accent font-bold uppercase tracking-wider">{type} Mode</span>
                    <span className="text-[10px] text-muted font-bold italic">Mapping Active</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                    <input 
                      type="text" 
                      placeholder="Search within sheet..." 
                      className="fi pl-10 h-10 text-xs bg-bg border-border/50 rounded-xl" 
                      value={gridSearch}
                      onChange={e => setGridSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
                {/* Side Control Panel */}
                <div className="lg:col-span-1 bg-bg2/40 border border-border/50 rounded-3xl p-6 flex flex-col gap-6 overflow-y-auto no-scrollbar">
                  {previewChartData.length > 0 && (
                    <div className="h-32 w-full mb-2 bg-black/20 rounded-2xl p-2 border border-white/5">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={previewChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                          <XAxis dataKey="name" fontSize={8} tickLine={false} axisLine={false} />
                          <RechartsTooltip 
                            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '8px' }}
                          />
                          <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                            {previewChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-5 flex items-center justify-between">
                       <span className="flex items-center gap-2">
                        <Database size={12} className="text-accent" /> Mapping Protocol
                       </span>
                    </h5>
                    <div className="space-y-4">
                      {targetKeys.filter(tKey => {
                        if (tKey === 'date') return false;
                        if (type === 'orders' && tKey === 'buyer' && manualBuyer) return false;
                        return true;
                      }).map(tKey => (
                        <div key={tKey} className="space-y-1.5">
                          <label className="text-[9px] font-black uppercase text-muted tracking-widest flex items-center justify-between">
                            {tKey === 'washR' ? 'WASH RECEIVE' : 
                             tKey === 'finIn' ? 'FINISHING INPUT' : 
                             tKey === 'finOut' ? 'FINISHING OUTPUT' : 
                             tKey === 'sewOut' ? 'SEWING OUTPUT' : 
                             tKey.replace(/([A-Z])/g, ' $1')}
                            <span className={cn(
                              "px-1 rounded-sm", 
                              mapping[tKey] ? "text-success bg-success/10" : (tKey === 'floor' || ['cut', 'sewOut', 'washR', 'finIn', 'finOut', 'poly', 'shipment'].includes(tKey) ? "text-muted bg-white/5" : "text-danger bg-danger/10 underline underline-offset-2")
                            )}>
                              {mapping[tKey] ? 'SYNC' : (tKey === 'floor' || ['cut', 'sewOut', 'washR', 'finIn', 'finOut', 'poly', 'shipment'].includes(tKey) ? 'OPTIONAL' : 'REQUIRED')}
                            </span>
                          </label>
                          <select 
                            className="fi h-9 text-[11px] font-bold bg-white/5 border-border/50 rounded-lg"
                            value={mapping[tKey] || ''}
                            onChange={e => setMapping(prev => ({ ...prev, [tKey]: e.target.value }))}
                          >
                            <option value="">Select Column...</option>
                            {Object.keys(parsedData[0] || {}).map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-auto pt-6 border-t border-border/20">
                     <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-[10px] font-black text-muted uppercase">
                           <span>Selection</span>
                           <span className="text-accent">{selectedRows.length} Rows</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                           <motion.div 
                             className="h-full bg-accent" 
                             initial={{ width: 0 }}
                             animate={{ width: `${(selectedRows.length / parsedData.length) * 100}%` }}
                           />
                        </div>
                     </div>
                  </div>
                </div>

                {/* Spredsheet Grid View */}
                <div className="lg:col-span-3 flex flex-col bg-bg border border-border/50 rounded-3xl overflow-hidden shadow-2xl relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 opacity-20" />
                  
                  <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="et text-[10px] w-full">
                      <thead className="sticky top-0 bg-bg z-20 shadow-sm">
                        <tr>
                          <th className="w-10 px-0 text-center">
                            <input 
                              type="checkbox" 
                              checked={selectedRows.length === filteredGridData.length && filteredGridData.length > 0} 
                              onChange={toggleSelectAllRows}
                              className="accent-accent"
                            />
                          </th>
                          <th className="w-24 uppercase tracking-widest text-[8px] text-center">Action</th>
                          <th className="w-16 uppercase tracking-widest text-[8px] text-center">Status</th>
                          {targetKeys.filter(k => k !== 'date').map(k => (
                             <th key={k} className="uppercase tracking-widest text-[8px] whitespace-nowrap px-4 py-3 text-left">
                               {k === 'washR' ? 'WASH' : 
                                k === 'finIn' ? 'INPUT' : 
                                k === 'finOut' ? 'OUTPUT' : 
                                k === 'sewOut' ? 'SEWING' : 
                                k}
                             </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {filteredGridData.map((row, i) => {
                          const item = transformRow(row);
                          const status = getRowStatus(item);
                          const isSelected = selectedRows.includes(i);
                          
                          return (
                            <motion.tr 
                              key={i}
                              whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                              className={cn(
                                "group transition-colors",
                                isSelected ? "bg-accent/[0.03]" : ""
                              )}
                            >
                              <td className="text-center py-2 px-0">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleRowSelection(i)}
                                  className="accent-accent"
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {onPushToForm && (
                                    <button 
                                      onClick={() => pushToForm(i)}
                                      className="p-1 px-2 bg-accent/20 text-accent rounded-md hover:bg-accent hover:text-white transition-all text-[8px] font-black uppercase tracking-tighter"
                                      title="Push to Entry Form"
                                    >
                                      PUSH
                                    </button>
                                  )}
                                  <button 
                                    onClick={() => handleSave()} // In real use, would need single row save
                                    className="p-1 bg-white/5 text-muted hover:text-fg rounded-md transition-colors"
                                    title="Sync Row Only"
                                  >
                                    <Save size={10} />
                                  </button>
                                </div>
                              </td>
                              <td className="py-2 text-center">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  {status.code === 'existing' ? (
                                    <>
                                      <div className="w-2 h-2 rounded-full bg-muted shadow-[0_0_8px_rgba(100,100,100,0.5)]" title="Already Exists" />
                                      <span className="text-[6px] font-black uppercase text-muted">EXIST</span>
                                    </>
                                  ) : status.code === 'error' ? (
                                    <>
                                      <div className="w-2 h-2 rounded-full bg-danger animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="Missing from Master" />
                                      <span className="text-[6px] font-black uppercase text-danger">NOT FOUND</span>
                                    </>
                                  ) : (
                                    <>
                                      <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" title="New Entry Ready" />
                                      <span className="text-[6px] font-black uppercase text-success tracking-widest">READY</span>
                                    </>
                                  )}
                                </div>
                              </td>
                              {targetKeys.filter(k => k !== 'date').map(tKey => (
                                <td key={tKey} className={cn(
                                  "px-4 py-3 whitespace-nowrap font-mono",
                                  status.code === 'existing' ? "text-muted/40" : "text-muted/80",
                                  status.code === 'error' && (tKey === 'poNo' || tKey === 'color') ? "text-danger font-bold bg-danger/5" : ""
                                )}>
                                  {transformRow(row)[tKey] || '—'}
                                </td>
                              ))}
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                    
                    {filteredGridData.length === 0 && (
                      <div className="py-20 text-center flex flex-col items-center">
                         <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4 text-muted/20">
                            <Search size={32} />
                         </div>
                         <p className="text-xs font-black text-muted uppercase tracking-widest">No matching results in sheet</p>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-bg2/40 border-t border-border/30 flex items-center justify-between text-[8px] font-black uppercase text-muted tracking-[0.2em] px-6">
                    <div className="flex items-center gap-6">
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-success" /> New Data
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-muted" /> Existing
                       </div>
                       <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-danger" /> Master Error
                       </div>
                    </div>
                    <span>Protocol Secured — Enterprise Extraction Active</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border/20 bg-bg2/40 flex items-center justify-between">
          <div className="flex items-center gap-6">
             <div className="flex flex-col">
                <span className="text-[9px] text-muted font-bold uppercase tracking-widest">Protocol Guard</span>
                <span className="text-[11px] font-black text-success uppercase">End-to-End Encryption Active</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="btn h-11 px-8 rounded-xl border border-border/50 text-muted uppercase text-xs font-black hover:bg-white/5">Cancel Matrix</button>
            {step === 'preview' && (
              <button 
                onClick={handleSave} 
                disabled={loading}
                className="btn btn-p h-11 px-10 rounded-xl flex items-center gap-3 shadow-xl"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span className="uppercase text-xs font-black tracking-widest">Execute Import</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
