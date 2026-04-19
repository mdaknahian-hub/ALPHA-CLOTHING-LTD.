import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  ArrowRightLeft, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  Layers,
  Activity,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Info,
  History as HistoryIcon,
  X,
  ChevronDown,
  LayoutGrid,
  ClipboardList,
  Eye,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { Order, FinishingTrackingEntry } from '../types';
import { format, parseISO } from 'date-fns';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';

interface FinishingTrackerProps {
  orders: Order[];
}

export default function FinishingTracker({ orders }: FinishingTrackerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [allEntries, setAllEntries] = useState<FinishingTrackingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboard, setIsDashboard] = useState(true);
  
  // Specific style details entries
  const [currentEntries, setCurrentEntries] = useState<FinishingTrackingEntry[]>([]);
  
  // Filters for the ledger table
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterLine, setFilterLine] = useState<string>('');
  
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    color: '',
    lineNo: '1',
    input: '',
    output: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [entryMode, setEntryMode] = useState<'single' | 'batch'>('single');
  const [batchRows, setBatchRows] = useState<any[]>([
    { id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), color: '', lineNo: '1', input: '', output: '' }
  ]);

  const addBatchRow = () => {
    setBatchRows([...batchRows, { id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), color: '', lineNo: '1', input: '', output: '' }]);
  };

  const removeBatchRow = (id: number) => {
    if (batchRows.length > 1) setBatchRows(batchRows.filter(r => r.id !== id));
  };

  const updateBatchRow = (id: number, field: string, value: string) => {
    setBatchRows(batchRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleDownload = () => {
    const header = [
      ["ALPHA CLOTHING LTD."],
      ["TENGURI, BKSP, ASHULIA, SAVAR, DHAKA"],
      ["Finishing Station Production Report"],
      [`Generated At: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}`],
      []
    ];

    const colHeaders = ["Date", "Style", "Color", "Line No", "Input", "Output", "WIP"];
    
    const rows = allEntries.map(e => [
      e.date, e.style, e.color, e.lineNo, e.input, e.output, e.input - e.output
    ]);

    const finalData = [...header, colHeaders, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Finishing Statistics");
    XLSX.writeFile(workbook, `Finishing_Output_${format(new Date(), 'ddMMMyy')}.xlsx`);
  };

  const handleBatchSubmit = async () => {
    if (!selectedStyle || !auth.currentUser) return;
    
    // Simple validation
    const invalid = batchRows.some(r => !r.color || (!r.input && !r.output));
    if (invalid) return setError('Please fill all colors and at least one quantity for each row');

    setIsLoading(true);
    try {
      const promises = batchRows.map(r => {
        const inputVal = parseInt(r.input) || 0;
        const outputVal = parseInt(r.output) || 0;
        return addDoc(collection(db, 'finishing_tracking'), {
          date: r.date,
          style: selectedStyle,
          poNo: 'STYLE-BASE',
          color: r.color,
          lineNo: r.lineNo,
          input: inputVal,
          output: outputVal,
          orderQty: currentAggregates[r.color]?.orderQty || 0,
          createdAt: new Date().toISOString(),
          userId: auth.currentUser!.uid
        });
      });
      await Promise.all(promises);
      setSuccess(true);
      setBatchRows([{ id: Date.now(), date: format(new Date(), 'yyyy-MM-dd'), color: '', lineNo: '1', input: '', output: '' }]);
      setTimeout(() => setSuccess(false), 3000);
      setError(null);
    } catch (err) {
      setError('Batch save failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Load ALL finishing entries to power the dashboard
  useEffect(() => {
    const q = query(
      collection(db, 'finishing_tracking'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FinishingTrackingEntry[];
      setAllEntries(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Filter currentEntries when a style is selected
  useEffect(() => {
    if (selectedStyle) {
      setCurrentEntries(allEntries.filter(e => e.style === selectedStyle));
    } else {
      setCurrentEntries([]);
    }
  }, [selectedStyle, allEntries]);

  // Aggregate stats for ALL styles (Dashboard)
  const dashboardStats = useMemo(() => {
    const stats: Record<string, any> = {};
    
    // Get unique styles from orders
    const styles = Array.from(new Set(orders.map(o => o.style)));
    
    styles.forEach(style => {
      const styleOrders = orders.filter(o => o.style === style);
      const styleEntries = allEntries.filter(e => e.style === style);
      
      const colorMap: Record<string, any> = {};
      styleOrders.forEach(o => {
        if (!colorMap[o.color]) colorMap[o.color] = { color: o.color, orderQty: 0, input: 0, output: 0 };
        colorMap[o.color].orderQty += o.orderQty;
      });

      styleEntries.forEach(e => {
        if (colorMap[e.color]) {
          colorMap[e.color].input += e.input;
          colorMap[e.color].output += e.output;
        }
      });

      const totalOrderQty = Object.values(colorMap).reduce((sum: number, c: any) => sum + c.orderQty, 0);
      const totalInput = Object.values(colorMap).reduce((sum: number, c: any) => sum + c.input, 0);
      const totalOutput = Object.values(colorMap).reduce((sum: number, c: any) => sum + c.output, 0);

      stats[style] = {
        style,
        totalOrderQty,
        totalInput,
        totalOutput,
        wip: totalInput - totalOutput,
        colors: Object.values(colorMap),
        progress: totalOrderQty > 0 ? (totalOutput / totalOrderQty) * 100 : 0
      };
    });

    return stats;
  }, [orders, allEntries]);

  // Filtered Styles for the dashboard
  const filteredDashboardStyles = useMemo(() => {
    const list = Object.values(dashboardStats);
    if (!searchTerm) return list;
    return list.filter((s: any) => s.style.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [dashboardStats, searchTerm]);

  // Selected Style Summary for Form/Ledger context
  const styleSummary = useMemo(() => {
    if (!selectedStyle || !dashboardStats[selectedStyle]) return null;
    return dashboardStats[selectedStyle];
  }, [selectedStyle, dashboardStats]);

  // Filtered LEDGER entries
  const filteredLedgerEntries = useMemo(() => {
    return currentEntries.filter(e => {
      const dateMatch = !filterDate || e.date === filterDate;
      const lineMatch = !filterLine || e.lineNo === filterLine;
      return dateMatch && lineMatch;
    });
  }, [currentEntries, filterDate, filterLine]);

  // Aggregates for current selected style (Line breakdown)
  const currentAggregates = useMemo(() => {
    const stats: Record<string, any> = {};
    if (styleSummary) {
      styleSummary.colors.forEach((c: any) => {
        stats[c.color] = {
          orderQty: c.orderQty,
          totalInput: 0,
          totalOutput: 0,
          lineStats: Object.fromEntries(['1','2','3','4','5','6','7'].map(ln => [ln, { input: 0, output: 0 }]))
        };
      });
      currentEntries.forEach(e => {
        if (stats[e.color]) {
          stats[e.color].totalInput += e.input;
          stats[e.color].totalOutput += e.output;
          if (stats[e.color].lineStats[e.lineNo]) {
            stats[e.color].lineStats[e.lineNo].input += e.input;
            stats[e.color].lineStats[e.lineNo].output += e.output;
          }
        }
      });
    }
    return stats;
  }, [styleSummary, currentEntries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStyle || !styleSummary || !auth.currentUser) return;
    const inputVal = parseInt(form.input) || 0;
    const outputVal = parseInt(form.output) || 0;
    if (!form.color) return setError('Select Color');

    const currentColorStats = currentAggregates[form.color];
    if (currentColorStats) {
      if (currentColorStats.totalInput + inputVal > currentColorStats.orderQty) {
        return setError(`Style Violation: Input exceeds Style Order Qty for ${form.color}`);
      }
      const currentLineStats = currentColorStats.lineStats[form.lineNo];
      if (currentLineStats.output + outputVal > currentLineStats.input + inputVal) {
        return setError(`Line Violation: Output exceeds Line Input`);
      }
    }

    try {
      await addDoc(collection(db, 'finishing_tracking'), {
        date: form.date,
        style: selectedStyle,
        poNo: 'STYLE-BASE',
        color: form.color,
        lineNo: form.lineNo,
        input: inputVal,
        output: outputVal,
        orderQty: currentColorStats?.orderQty || 0,
        createdAt: new Date().toISOString(),
        userId: auth.currentUser.uid
      });
      setForm({ ...form, input: '', output: '' });
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) { setError('Failed to save'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    try { await deleteDoc(doc(db, 'finishing_tracking', id)); } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Search */}
      <div className="bg-bg2/50 backdrop-blur-3xl border border-border rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-[100px]" />
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 relative z-10">
          <div>
             <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                   <ArrowRightLeft size={24} className="text-indigo-500" />
                 </div>
                <div>
                   <h2 className="text-2xl font-black tracking-tight uppercase leading-none">Finishing Station</h2>
                   <p className="text-[10px] text-muted font-black tracking-[0.2em] uppercase mt-1">Smart Style-Based Production Repository</p>
                </div>
             </div>
             
             {/* Mode Toggle */}
             <div className="flex bg-bg/50 p-1 rounded-xl w-fit border border-border mt-4">
                <button 
                   onClick={() => { setIsDashboard(true); setSelectedStyle(null); }}
                   className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all", isDashboard ? "bg-bg shadow-lg text-indigo-400" : "text-muted hover:text-white")}
                >
                   <LayoutGrid size={14} /> Dashboard
                </button>
                <button 
                   onClick={() => setIsDashboard(false)}
                   disabled={!selectedStyle}
                   className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all", !isDashboard && selectedStyle ? "bg-bg shadow-lg text-indigo-400" : "text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed")}
                >
                   <ClipboardList size={14} /> Style Detail
                </button>
             </div>
          </div>

          <div className="flex items-center gap-4 w-full xl:w-[500px]">
             <div className="relative group w-full">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-indigo-400 transition-colors" />
                <input 
                   type="text" 
                   placeholder="Search Style Code..." 
                   className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <button className="btn btn-p h-14 px-8 box-border flex items-center gap-2" onClick={handleDownload}>
                <Download size={18} /> Download
             </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isDashboard ? (
          <motion.div 
            key="dashboard"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filteredDashboardStyles.map((style: any) => (
              <StyleCard 
                key={style.style} 
                data={style} 
                onOpen={(s) => { setSelectedStyle(s); setIsDashboard(false); }} 
              />
            ))}
            {filteredDashboardStyles.length === 0 && (
              <div className="col-span-full py-40 text-center opacity-30 italic font-medium">No styles found in repository.</div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="details"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Control Bar for Details */}
            <div className="flex items-center gap-4 justify-between bg-bg2/40 border border-border p-4 rounded-3xl">
               <button onClick={() => setIsDashboard(true)} className="flex items-center gap-2 text-xs font-black text-muted hover:text-white transition-colors">
                  <ChevronRight size={16} className="rotate-180" /> Back to Dashboard
               </button>
               <div className="text-sm font-black uppercase text-indigo-400 tracking-tighter">{selectedStyle}</div>
            </div>

            {/* Entry Form (Top) */}
            <section className="bg-bg2/80 border border-border rounded-[40px] p-8 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                 <div className="flex items-center gap-3">
                    <Plus size={18} className="text-indigo-500" />
                    <h3 className="text-lg font-black uppercase tracking-tight">Production Entry</h3>
                 </div>
                 
                 <div className="flex bg-bg/50 p-1 rounded-xl w-fit border border-border">
                    <button 
                       onClick={() => setEntryMode('single')}
                       className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all", entryMode === 'single' ? "bg-bg shadow text-indigo-400" : "text-muted hover:text-white")}
                    >
                       Single Entry
                    </button>
                    <button 
                       onClick={() => setEntryMode('batch')}
                       className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all", entryMode === 'batch' ? "bg-bg shadow text-indigo-400" : "text-muted hover:text-white")}
                    >
                       Batch (History) Entry
                    </button>
                 </div>
              </div>

              {entryMode === 'single' ? (
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1 font-mono">01_DATE</label>
                    <input type="date" required className="fi py-3 shadow-inner" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1 font-mono">02_COLOR</label>
                    <select required className="fi py-3" value={form.color} onChange={(e) => setForm({...form, color: e.target.value})}>
                      <option value="">Color...</option>
                      {styleSummary?.colors.map((c: any) => <option key={c.color} value={c.color}>{c.color}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1 font-mono">03_LINE</label>
                    <select required className="fi py-3" value={form.lineNo} onChange={(e) => setForm({...form, lineNo: e.target.value})}>
                      {['1','2','3','4','5','6','7'].map(n => <option key={n} value={n}>Line {n}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-1 font-mono">04_IN_QTY</label>
                    <input type="number" required placeholder="Qty" className="fi py-3 font-black num" value={form.input} onChange={(e) => setForm({...form, input: e.target.value})} />
                    {form.color && currentAggregates[form.color] && (
                      <div className="flex justify-between px-1 text-[9px] font-bold text-muted/60 uppercase">
                         <span>Order: <span className="text-white">{currentAggregates[form.color].orderQty.toLocaleString()}</span></span>
                         <span>Ach: <span className="text-indigo-400">{currentAggregates[form.color].totalInput.toLocaleString()}</span></span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-success uppercase tracking-widest pl-1 font-mono">05_OUT_QTY</label>
                    <input type="number" required placeholder="Qty" className="fi py-3 font-black num" value={form.output} onChange={(e) => setForm({...form, output: e.target.value})} />
                    {form.color && currentAggregates[form.color] && (
                      <div className="flex justify-between px-1 text-[9px] font-bold text-muted/60 uppercase">
                         <span>In: <span className="text-indigo-400">{currentAggregates[form.color].totalInput.toLocaleString()}</span></span>
                         <span>Ach: <span className="text-success">{currentAggregates[form.color].totalOutput.toLocaleString()}</span></span>
                      </div>
                    )}
                  </div>
                  <button type="submit" className={cn("btn btn-p w-full py-3.5 text-[10px] font-black tracking-[0.2em] shadow-xl transition-all", success && "bg-success")}>
                    {success ? 'SUCCESS' : 'SAVE RECORD'}
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] font-black text-muted uppercase tracking-widest">
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Color</th>
                          <th className="px-3 py-2">Line</th>
                          <th className="px-3 py-2">Input</th>
                          <th className="px-3 py-2">Output</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="space-y-2">
                        {batchRows.map((row) => (
                          <tr key={row.id}>
                            <td className="px-1 py-1"><input type="date" className="fi text-[10px] py-2" value={row.date} onChange={(e) => updateBatchRow(row.id, 'date', e.target.value)} /></td>
                            <td className="px-1 py-1">
                               <select className="fi text-[10px] py-2" value={row.color} onChange={(e) => updateBatchRow(row.id, 'color', e.target.value)}>
                                  <option value="">Color...</option>
                                  {styleSummary?.colors.map((c: any) => <option key={c.color} value={c.color}>{c.color}</option>)}
                               </select>
                            </td>
                            <td className="px-1 py-1">
                               <select className="fi text-[10px] py-2" value={row.lineNo} onChange={(e) => updateBatchRow(row.id, 'lineNo', e.target.value)}>
                                  {['1','2','3','4','5','6','7'].map(n => <option key={n} value={n}>Line {n}</option>)}
                               </select>
                            </td>
                            <td className="px-1 py-1"><input type="number" placeholder="Input" className="fi text-[10px] py-2 num" value={row.input} onChange={(e) => updateBatchRow(row.id, 'input', e.target.value)} /></td>
                            <td className="px-1 py-1"><input type="number" placeholder="Output" className="fi text-[10px] py-2 num" value={row.output} onChange={(e) => updateBatchRow(row.id, 'output', e.target.value)} /></td>
                            <td className="px-1 py-1">
                               <button onClick={() => removeBatchRow(row.id)} className="p-2 text-muted hover:text-danger"><Trash2 size={14}/></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                     <button onClick={addBatchRow} className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 hover:underline">
                        <Plus size={14} /> Add Another Row
                     </button>
                     <button onClick={handleBatchSubmit} disabled={isLoading} className={cn("btn btn-p px-10 py-3 text-[10px] font-black tracking-widest shadow-xl", success && "bg-success")}>
                        {isLoading ? 'SAVING...' : success ? 'BATCH SAVED' : 'SAVE ALL RECORDS'}
                     </button>
                  </div>
                </div>
              )}
              {error && <div className="mt-4 p-3 bg-danger/10 text-danger text-[10px] font-black rounded-xl uppercase tracking-tighter border border-danger/20 flex gap-2 items-center"><AlertCircle size={14}/> {error}</div>}
            </section>

            {/* Ledger Table */}
            <div className="bg-bg2/40 border border-border rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-3xl min-h-[500px] flex flex-col">
               <div className="p-6 border-b border-border bg-bg/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h3 className="font-black uppercase tracking-widest text-sm flex items-center gap-2"><HistoryIcon size={18} className="text-muted" /> Production Ledger</h3>
                  <div className="flex items-center gap-2">
                    <input type="date" className="fi py-1 px-3 text-[10px] w-auto inline-block border-border/50" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                    <select className="fi py-1 px-3 text-[10px] w-auto inline-block border-border/50" value={filterLine} onChange={(e) => setFilterLine(e.target.value)}>
                       <option value="">Line...</option>
                       {['1','2','3','4','5','6','7'].map(n => <option key={n} value={n}>L-{n}</option>)}
                    </select>
                    {(filterDate || filterLine) && <button onClick={() => {setFilterDate(''); setFilterLine('');}} className="p-1 px-2 text-[10px] text-danger font-black">X</button>}
                  </div>
               </div>
               <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-bg text-[9px] font-black text-muted uppercase tracking-[0.2em] border-b border-border">
                      <tr>
                        <th className="px-6 py-4 text-center">Date</th>
                        <th className="px-6 py-4">Color</th>
                        <th className="px-6 py-4 text-center">Line</th>
                        <th className="px-6 py-4 text-center">Input</th>
                        <th className="px-6 py-4 text-center">Output</th>
                        <th className="px-6 py-4 text-center">WIP</th>
                        <th className="px-6 py-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {filteredLedgerEntries.map(e => (
                        <tr key={e.id} className="hover:bg-indigo-500/[0.03] transition-colors group">
                           <td className="px-6 py-4 text-center">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black num leading-none">{format(parseISO(e.date), 'dd')}</span>
                                <span className="text-[8px] font-black text-muted uppercase tracking-tighter mt-1">{format(parseISO(e.date), 'MMM').toUpperCase()}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4 font-black text-[11px] uppercase text-white/80">{e.color}</td>
                           <td className="px-6 py-4 text-center"><span className="p-1 px-2 bg-bg border border-border rounded-lg text-[10px] font-black text-indigo-400">L-{e.lineNo}</span></td>
                           <td className="px-6 py-4 text-center font-black num text-sm">{e.input.toLocaleString()}</td>
                           <td className="px-6 py-4 text-center font-black num text-sm text-success">{e.output.toLocaleString()}</td>
                           <td className="px-6 py-4 text-center font-black num text-sm text-accent">{(e.input - e.output).toLocaleString()}</td>
                           <td className="px-6 py-4 text-right"><button onClick={() => handleDelete(e.id)} className="p-2 text-muted hover:text-danger opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredLedgerEntries.length === 0 && <div className="py-20 text-center opacity-30 text-xs italic font-medium">No results for this query.</div>}
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface StyleCardProps {
  data: any;
  onOpen: (s: string) => void;
  key?: React.Key;
}

function StyleCard({ data, onOpen }: StyleCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <motion.div 
      layout
      className="bg-bg2/50 backdrop-blur-xl border border-border rounded-[32px] p-6 shadow-xl hover:border-indigo-500/30 transition-all group relative animate-in fade-in slide-in-from-bottom"
    >
      <div className="flex justify-between items-start mb-6">
         <div>
            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Production Unit</span>
            <h4 className="text-xl font-black text-white uppercase tracking-tight leading-none">{data.style}</h4>
         </div>
         <button 
           onClick={() => onOpen(data.style)}
           className="w-10 h-10 bg-bg rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors border border-border"
         >
            <Eye size={18} className="text-muted" />
         </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
         <div className="space-y-1">
            <span className="text-[9px] font-bold text-muted uppercase block">Order</span>
            <span className="text-sm font-black num">{data.totalOrderQty.toLocaleString()}</span>
         </div>
         <div className="space-y-1">
            <span className="text-[9px] font-bold text-muted uppercase block text-indigo-400">Total In</span>
            <span className="text-sm font-black num">{data.totalInput.toLocaleString()}</span>
         </div>
         <div className="space-y-1">
            <span className="text-[9px] font-bold text-muted uppercase block text-accent">WIP</span>
            <span className="text-sm font-black num">{data.wip.toLocaleString()}</span>
         </div>
      </div>

      <div className="space-y-2 mb-6">
         <div className="flex justify-between items-center text-[10px] font-black">
            <span className="text-muted uppercase tracking-widest">Efficiency</span>
            <span className="text-success">{Math.round(data.progress)}%</span>
         </div>
         <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(data.progress, 100)}%` }} />
         </div>
      </div>

      {/* Color Dropdown Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-3 px-4 bg-bg border border-border rounded-2xl text-[10px] font-black tracking-widest text-muted hover:text-white transition-all group/btn"
      >
         VIEW REPOSITORY COLORING
         <ChevronDown size={14} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mt-4 space-y-2 border-l-2 border-indigo-500/20 pl-4"
          >
            {data.colors.map((c: any) => (
              <div key={c.color} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-white/80">{c.color}</span>
                    <span className="text-[8px] font-bold text-muted uppercase italic">Order: {c.orderQty}</span>
                 </div>
                 <div className="text-right">
                    <div className="flex items-center gap-2 text-[10px] font-black num">
                       <span className="text-indigo-400">In: {c.input}</span>
                       <span className="text-success">Out: {c.output}</span>
                    </div>
                    <span className="text-[9px] font-bold text-accent uppercase">WIP: {c.input - c.output}</span>
                 </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
