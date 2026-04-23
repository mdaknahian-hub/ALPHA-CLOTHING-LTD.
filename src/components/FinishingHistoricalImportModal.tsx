import React, { useState } from 'react';
import { X, FileUp, AlertCircle, Database, Calendar, History as HistoryIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays } from 'date-fns';
import { Order, FinishingTrackingEntry } from '../types';
import { cn } from '../lib/utils';

interface FinishingHistoricalImportModalProps {
  onClose: () => void;
  onSave: (entries: Omit<FinishingTrackingEntry, 'id' | 'createdAt' | 'userId'>[]) => Promise<void>;
  orders: Order[];
}

export default function FinishingHistoricalImportModal({ onClose, onSave, orders }: FinishingHistoricalImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [parsedData, setParsedData] = useState<(Omit<FinishingTrackingEntry, 'id' | 'createdAt' | 'userId'> & { error?: string })[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [headerMap, setHeaderMap] = useState<Record<string, number>>({});

  const commonHeaderMaps: Record<string, string[]> = {
    style: ['style', 'style no', 'style#', 'item', 'model'],
    poNo: ['po no', 'po number', 'po#', 'order id', 'order no', 'purchase order'],
    color: ['color', 'colour', 'shade'],
    lineNo: ['line', 'line no', 'line#', 'station'],
    input: ['input', 'finishing in', 'fin in', 'input qty'],
    output: ['output', 'finishing out', 'fin out', 'output qty', 'packed'],
    orderQty: ['order qty', 'qty', 'total qty', 'order']
  };

  const findHeaderIndex = (headers: string[], targetKeys: string[]) => {
    return headers.findIndex(h => {
      const normalizedHeader = h.toLowerCase().trim();
      return targetKeys.some(key => normalizedHeader.includes(key.toLowerCase()));
    });
  };

  const handleParse = () => {
    const lines = rawText.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    const results: (Omit<FinishingTrackingEntry, 'id' | 'createdAt' | 'userId'> & { error?: string })[] = [];
    const errs: string[] = [];
    
    if (!startDate) {
      errs.push('Please select a Starting Date');
      setErrors(errs);
      return;
    }

    let dataStartIdx = 0;
    let detectedMap: Record<string, number> = {};

    const firstLineParts = lines[0].split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p !== '');
    const isHeaderCandidate = firstLineParts.some(p => 
      ['style', 'po', 'color', 'line', 'input', 'output'].some(key => p.toLowerCase().includes(key))
    );

    if (isHeaderCandidate) {
      Object.entries(commonHeaderMaps).forEach(([key, aliases]) => {
        const idx = findHeaderIndex(firstLineParts, aliases);
        if (idx !== -1) detectedMap[key] = idx;
      });
      dataStartIdx = 1;
      setHeaderMap(detectedMap);
    } else {
      detectedMap = {
        style: 0, poNo: 1, color: 2, lineNo: 3, input: 4, output: 5, orderQty: 6
      };
      setHeaderMap({});
    }

    const dataLines = lines.slice(dataStartIdx);

    dataLines.forEach((line, idx) => {
      const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(p => p !== '');
      
      const getVal = (key: string) => {
        const index = detectedMap[key];
        return index !== undefined ? parts[index] : '';
      };

      const style = getVal('style');
      const poNo = getVal('poNo');
      const color = getVal('color');
      const lineNo = getVal('lineNo');
      
      if (!style && !poNo) return;

      if (style?.toLowerCase().includes('style') || 
          poNo?.toLowerCase().includes('po no') || 
          poNo?.toLowerCase().includes('total') ||
          style?.toLowerCase() === 'total' ||
          !style || !poNo) return;

      const inputStr = getVal('input');
      const outputStr = getVal('output');
      const orderQtyStr = getVal('orderQty');

      let rowError = '';
      
      const matchingOrder = orders.find(o => 
        String(o.poNo).toLowerCase() === String(poNo).toLowerCase() && 
        o.color.toLowerCase() === color.toLowerCase() &&
        o.style.toLowerCase() === style.toLowerCase()
      );

      if (!matchingOrder) {
        rowError = `Order missing: PO ${poNo}, Color ${color}`;
        errs.push(`Row ${idx + 2}: ${rowError} (Create Order first)`);
      }

      const parseNum = (s: string) => {
        if (!s) return 0;
        const n = Number(String(s).replace(/,/g, '').replace(/%/g, '').replace(/[()]/g, ''));
        return isNaN(n) ? 0 : n;
      };

      const entry: Omit<FinishingTrackingEntry, 'id' | 'createdAt' | 'userId'> & { error?: string } = {
        date: startDate,
        poNo: String(poNo),
        color: color || 'N/A',
        style: style,
        lineNo: lineNo || 'L-00',
        input: parseNum(inputStr),
        output: parseNum(outputStr),
        orderQty: parseNum(orderQtyStr) || (matchingOrder?.orderQty || 0),
        error: rowError
      };

      results.push(entry);
    });

    setParsedData(results);
    setErrors(errs);
  };

  const handleConfirmSave = async () => {
    const validData = parsedData.filter(r => !r.error).map(({ error, ...rest }) => rest);
    if (validData.length === 0) return;
    
    setLoading(true);
    await onSave(validData);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <HistoryIcon size={18} className="text-accent" />
            Finishing Historical Data Import
          </h3>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={12} /> 1. Starting Date *
                </label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="fi"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <Database size={12} /> 2. Paste Excel Data *
                </label>
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg space-y-2">
                  <p className="text-[10px] text-muted leading-relaxed">
                    Paste your finishing data from Excel. Map Style, PO, Color, Line, Input, and Output.
                  </p>
                  {Object.keys(headerMap).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(headerMap).map(key => (
                        <span key={key} className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[9px] font-bold uppercase ring-1 ring-accent/20">
                          {key} ✓
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <textarea 
                  className="fi min-h-[300px] font-mono text-[10px] leading-relaxed"
                  placeholder="Paste rows (with headers) directly from your Excel Sheet..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button 
                  onClick={handleParse}
                  className="btn btn-p w-full mt-2"
                  disabled={!rawText || !startDate}
                >
                  Preview & Validate
                </button>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Preview & Validation</label>
              
              {errors.length > 0 && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg space-y-1">
                  <ul className="text-[10px] text-danger/80 list-disc pl-4 max-h-[80px] overflow-y-auto">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-[400px] overflow-auto">
                  <table className="et text-[10px]">
                    <thead className="sticky top-0 bg-bg2 z-10">
                      <tr>
                        <th>Style</th>
                        <th>PO</th>
                        <th>Color</th>
                        <th>Line</th>
                        <th className="text-right">Input</th>
                        <th className="text-right">Output</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, i) => (
                        <tr key={i} className={cn(row.error && "bg-danger/10")}>
                          <td>{row.style}</td>
                          <td className="font-bold text-accent">{row.poNo}</td>
                          <td>{row.color}</td>
                          <td>{row.lineNo}</td>
                          <td className="num">{row.input.toLocaleString()}</td>
                          <td className="num">{row.output.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-bg2 flex justify-between items-center">
          <div className="text-xs text-muted">
            Ready to import: <span className="text-accent font-bold">{parsedData.filter(r => !r.error).length}</span> entries
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-o">Cancel</button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-p px-8"
              disabled={parsedData.filter(r => !r.error).length === 0 || loading}
            >
              {loading ? 'Importing...' : 'Save Finishing Data'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
