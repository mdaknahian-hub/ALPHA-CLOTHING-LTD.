import React, { useState, useMemo } from 'react';
import { X, FileUp, AlertCircle, Database, Calendar, History } from 'lucide-react';
import { motion } from 'motion/react';
import { format, parseISO, parse, isValid, subDays } from 'date-fns';
import { Order, ProductionEntry } from '../types';
import { cn } from '../lib/utils';

interface HistoricalImportModalProps {
  onClose: () => void;
  onSave: (entries: Omit<ProductionEntry, 'id'>[]) => Promise<void>;
  orders: Order[];
}

export default function HistoricalImportModal({ onClose, onSave, orders }: HistoricalImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
  const [parsedData, setParsedData] = useState<(Omit<ProductionEntry, 'id'> & { style: string; error?: string })[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleParse = () => {
    const lines = rawText.split('\n').filter(l => l.trim());
    const results: (Omit<ProductionEntry, 'id'> & { style: string; error?: string })[] = [];
    const errs: string[] = [];
    
    if (!startDate) {
      errs.push('Please select a Starting Date');
      setErrors(errs);
      return;
    }

    lines.forEach((line, idx) => {
      const parts = line.split('\t').map(p => p.trim());
      
      // Mapping based on user's Excel screenshot:
      // 0: STYLE
      // 1: PO NO
      // 2: SHIP DATE
      // 3: COLOR
      // 4: ORDER QTY
      // 5: CUT QTY
      // 6: CUY %
      // 7: SEWING QTY
      // 8: SEWING WIP
      // 9: WASH REC
      // 10: WASH WIP
      // 11: TOTAL INPUT (Fin In)
      // 12: TOTAL OUTPUT (Fin Out)
      // 13: TOTAL POLY
      
      if (parts.length < 6) return; 

      const style = parts[0];
      const poNo = parts[1];
      const color = parts[3];
      const cutStr = parts[5];
      const sewStr = parts[7];
      const washStr = parts[9];
      const finInStr = parts[11];
      const finOutStr = parts[12];
      const polyStr = parts[13];
      
      // Skip header or total rows
      if (style.toLowerCase() === 'style' || poNo.toLowerCase() === 'po no' || !style || !poNo || !color) return;
      if (isNaN(Number(poNo)) && poNo.length < 5) return; // Skip sub-total rows

      let rowError = '';
      
      // Find matching order
      const matchingOrder = orders.find(o => 
        o.poNo === poNo && 
        o.color.toLowerCase() === color.toLowerCase() &&
        o.style.toLowerCase() === style.toLowerCase()
      );

      if (!matchingOrder) {
        rowError = `Order not found (Style: ${style}, PO: ${poNo}, Color: ${color})`;
        errs.push(`Row ${idx + 1}: ${rowError}`);
      }

      const parseNum = (s: string) => {
        if (!s) return 0;
        const n = Number(s.replace(/,/g, '').replace(/%/g, ''));
        return isNaN(n) ? 0 : n;
      };

      const entry: Omit<ProductionEntry, 'id'> & { style: string; error?: string } = {
        date: startDate,
        poNo,
        color,
        style,
        cut: parseNum(cutStr),
        sewOut: parseNum(sewStr),
        washR: parseNum(washStr),
        finIn: parseNum(finInStr),
        finOut: parseNum(finOutStr),
        poly: parseNum(polyStr),
        shipment: 0,
        error: rowError
      };

      results.push(entry);
    });

    setParsedData(results);
    setErrors(errs);
  };

  const handleConfirmSave = async () => {
    const validData = parsedData.filter(r => !r.error).map(({ style, error, ...rest }) => rest);
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
            <History size={18} className="text-accent" />
            Historical Data Import (Opening Balance)
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
                <p className="text-[10px] text-muted italic">All production will be recorded on this date.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider flex items-center gap-2">
                  <Database size={12} /> 2. Paste Excel Data *
                </label>
                <p className="text-[10px] text-muted italic mb-2">
                  Required Columns (Copy from Excel):<br/>
                  <span className="text-accent font-bold">STYLE, PO NO, SHIP DATE, COLOR, ORDER QTY, CUT QTY, CUY %, SEWING QTY, SEW-WIP, WASH-REC, WASH-WIP, FIN-IN, FIN-OUT, POLY</span>
                </p>
                <textarea 
                  className="fi min-h-[250px] font-mono text-[10px] leading-relaxed"
                  placeholder="Paste rows from Excel here..."
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
                  <div className="flex items-center gap-2 text-danger text-[11px] font-bold">
                    <AlertCircle size={14} /> Validation Errors:
                  </div>
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
                        <th className="text-right">Cut</th>
                        <th className="text-right">Sew</th>
                        <th className="text-right">Wash</th>
                        <th className="text-right">Fin-In</th>
                        <th className="text-right">Fin-Out</th>
                        <th className="text-right">Poly</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, i) => (
                        <tr key={i} className={cn(row.error && "bg-danger/10")}>
                          <td className={cn(row.error && "text-danger font-bold")}>{row.style}</td>
                          <td className={cn("font-bold", row.error ? "text-danger" : "text-accent")}>{row.poNo}</td>
                          <td className={cn(row.error && "text-danger")}>{row.color}</td>
                          <td className="num">{row.cut.toLocaleString()}</td>
                          <td className="num">{row.sewOut.toLocaleString()}</td>
                          <td className="num">{row.washR.toLocaleString()}</td>
                          <td className="num">{row.finIn.toLocaleString()}</td>
                          <td className="num">{row.finOut.toLocaleString()}</td>
                          <td className="num">{row.poly.toLocaleString()}</td>
                        </tr>
                      ))}
                      {parsedData.length === 0 && (
                        <tr>
                          <td colSpan={9} className="py-20 text-center text-muted italic">
                            No data parsed yet. Paste data and click Preview.
                          </td>
                        </tr>
                      )}
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
            {parsedData.some(r => r.error) && (
              <span className="ml-2 text-danger font-bold">
                ({parsedData.filter(r => r.error).length} errors found)
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-o">Cancel</button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-p px-8"
              disabled={parsedData.filter(r => !r.error).length === 0 || loading}
            >
              {loading ? 'Importing...' : 'Confirm & Save Historical Data'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
