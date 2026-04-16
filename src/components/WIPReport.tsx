import React, { useMemo, useState } from 'react';
import { BarChart3, Info, AlertTriangle, CheckCircle2, AlertCircle, Search, Clock, X, ArrowRight, Database } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface WIPReportProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
}

export default function WIPReport({ orders, entries, getPOInfo }: WIPReportProps) {
  const [search, setSearch] = useState('');
  const [historyPO, setHistoryPO] = useState<string | null>(null);
  const [selectedError, setSelectedError] = useState<string[] | null>(null);

  const summaries = useMemo(() => {
    if (!historyPO) return { lines: [], floors: [] };
    const poEntries = entries.filter(e => e.poNo === historyPO);
    
    const lineMap: Record<string, any> = {};
    const floorMap: Record<string, any> = {};

    poEntries.forEach(e => {
      // Line Summary (Fin In/Out)
      if (e.finIn > 0 || e.finOut > 0) {
        const lKey = `${e.color}-${e.lineNo || 'Unassigned'}`;
        if (!lineMap[lKey]) {
          lineMap[lKey] = { color: e.color, lineNo: e.lineNo || 'Unassigned', finIn: 0, finOut: 0 };
        }
        lineMap[lKey].finIn += e.finIn;
        lineMap[lKey].finOut += e.finOut;
      }

      // Floor Summary (Poly)
      if (e.poly > 0) {
        const fKey = `${e.color}-${e.floor || 'Unassigned'}`;
        if (!floorMap[fKey]) {
          floorMap[fKey] = { color: e.color, floor: e.floor || 'Unassigned', poly: 0 };
        }
        floorMap[fKey].poly += e.poly;
      }
    });

    return {
      lines: Object.values(lineMap).sort((a, b) => a.color.localeCompare(b.color) || a.lineNo.localeCompare(b.lineNo)),
      floors: Object.values(floorMap).sort((a, b) => a.color.localeCompare(b.color) || a.floor.localeCompare(b.floor))
    };
  }, [entries, historyPO]);

  const wipData = useMemo(() => {
    // Get unique POs from entries
    const uniquePOs = Array.from(new Set(entries.map(e => e.poNo)));
    const today = new Date();
    const s = search.toLowerCase();
    
    const rows = uniquePOs.map(po => {
      const info = getPOInfo(po);
      if (!info) return null;

      const poEntries = entries.filter(e => e.poNo === po);
      const activeLines = Array.from(new Set(poEntries.filter(e => e.lineNo).map(e => e.lineNo))).join(', ');
      const activeFloors = Array.from(new Set(poEntries.filter(e => e.floor).map(e => e.floor))).join(', ');

      // Filter by search
      if (s && 
          !info.poNo.toLowerCase().includes(s) && 
          !info.buyer.toLowerCase().includes(s) && 
          !info.style.toLowerCase().includes(s) &&
          !activeLines.toLowerCase().includes(s) &&
          !activeFloors.toLowerCase().includes(s)
      ) {
        return null;
      }
      
      const totalOrderQty = info.totalQty;
      const cumCut = poEntries.reduce((s, e) => s + (e.cut || 0), 0);
      const cumSewOut = poEntries.reduce((s, e) => s + (e.sewOut || 0), 0);
      const cumWashR = poEntries.reduce((s, e) => s + (e.washR || 0), 0);
      const cumFinIn = poEntries.reduce((s, e) => s + (e.finIn || 0), 0);
      const cumFinOut = poEntries.reduce((s, e) => s + (e.finOut || 0), 0);
      const cumPoly = poEntries.reduce((s, e) => s + (e.poly || 0), 0);
      const cumShipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0);
      const stock = cumPoly - cumShipment;

      const cuttingAch = totalOrderQty ? Math.round((cumCut / totalOrderQty) * 100 * 10) / 10 : 0;
      const sewWip = cumCut - cumSewOut;
      const washWip = cumSewOut - cumWashR;
      const inputWip = cumWashR - cumFinIn;
      const outputWip = cumFinIn - cumFinOut;
      const polyWip = totalOrderQty - cumPoly;

      // Risk Calculation
      const shipDate = parseISO(info.shipDate);
      const daysLeft = differenceInCalendarDays(shipDate, today);
      
      let riskLevel: 'high' | 'middle' | 'safe' = 'safe';
      if (daysLeft <= 3) riskLevel = 'high';
      else if (daysLeft <= 6) riskLevel = 'middle';
      else if (daysLeft <= 10) riskLevel = 'safe';

      return {
        buyer: info.buyer,
        style: info.style,
        poNo: po,
        shipDate: info.shipDate,
        orderQty: totalOrderQty,
        cumCut,
        cuttingAch,
        cumSewOut,
        sewWip,
        cumWashR,
        washWip,
        cumFinIn,
        inputWip,
        cumFinOut,
        outputWip,
        cumPoly,
        polyWip,
        cumShipment,
        stock,
        daysLeft,
        riskLevel,
        activeLines,
        activeFloors
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    return rows.sort((a, b) => a.buyer.localeCompare(b.buyer) || a.poNo.localeCompare(b.poNo));
  }, [entries, getPOInfo]);

  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <span className="flex items-center gap-1 text-danger font-bold text-[10px] uppercase bg-danger/10 px-2 py-0.5 rounded-full"><AlertCircle size={10} /> High Risk</span>;
      case 'middle':
        return <span className="flex items-center gap-1 text-accent font-bold text-[10px] uppercase bg-accent/10 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> Middle Risk</span>;
      default:
        return <span className="flex items-center gap-1 text-success font-bold text-[10px] uppercase bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} /> Safe</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BarChart3 size={20} className="text-accent" />
            Production WIP & Risk Analysis
          </h2>
          <p className="text-[11px] text-muted">PO-wise aggregated Work-in-Progress status and shipment risk assessment</p>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="text"
              placeholder="Search PO, Buyer, Style, Line or Floor..."
              className="fi pl-10 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="bg-bg2/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
        <div className="overflow-x-auto max-h-[75vh] no-scrollbar">
          <table className="et text-[11px]">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th className="text-left">Buyer</th>
                <th className="text-left">Style</th>
                <th>PO No</th>
                <th>Ship Date</th>
                <th>Lines</th>
                <th>Floors</th>
                <th>Order Qty</th>
                <th>Cut Qty</th>
                <th>Cut %</th>
                <th>Sewing</th>
                <th>Sew WIP</th>
                <th>Wash Recv</th>
                <th>Wash WIP</th>
                <th>Input Qty</th>
                <th>Input WIP</th>
                <th>Output Qty</th>
                <th>Output WIP</th>
                <th>Poly Qty</th>
                <th>Poly WIP</th>
                <th>Shipment</th>
                <th>Stock</th>
                <th>Risk Status</th>
                <th className="no-print">History</th>
              </tr>
            </thead>
            <tbody>
              {wipData.map((r, i) => (
                <tr key={r.poNo}>
                  <td className="num text-muted/50">{i + 1}</td>
                  <td className="text-left font-black text-fg">{r.buyer}</td>
                  <td className="text-left font-mono text-[10px] opacity-70">{r.style}</td>
                  <td className="font-mono text-accent font-bold text-[10px]">{r.poNo}</td>
                  <td className="whitespace-nowrap font-bold">{safeFormat(r.shipDate, 'dd-MMM-yy')}</td>
                  <td className="text-accent font-bold text-[9px] max-w-[80px] truncate" title={r.activeLines}>{r.activeLines || '—'}</td>
                  <td className="text-success font-bold text-[9px] max-w-[80px] truncate" title={r.activeFloors}>{r.activeFloors || '—'}</td>
                  <td className="num font-black text-fg">{(r.orderQty || 0).toLocaleString()}</td>
                  <td className="num">{(r.cumCut || 0).toLocaleString()}</td>
                  <td className="num text-accent font-bold">{r.cuttingAch}%</td>
                  <td className="num">{(r.cumSewOut || 0).toLocaleString()}</td>
                  <td className={cn("num transition-all", r.sewWip > 500 ? "text-danger bg-danger/10 font-black" : "")}>{(r.sewWip || 0).toLocaleString()}</td>
                  <td className="num">{(r.cumWashR || 0).toLocaleString()}</td>
                  <td className={cn("num transition-all", r.washWip > 500 ? "text-danger bg-danger/10 font-black" : "")}>{(r.washWip || 0).toLocaleString()}</td>
                  <td className="num">{(r.cumFinIn || 0).toLocaleString()}</td>
                  <td className={cn("num transition-all", r.inputWip > 500 ? "text-danger bg-danger/10 font-black" : "")}>{(r.inputWip || 0).toLocaleString()}</td>
                  <td className="num">{(r.cumFinOut || 0).toLocaleString()}</td>
                  <td className={cn("num transition-all", r.outputWip > 500 ? "text-danger bg-danger/10 font-black" : "")}>{(r.outputWip || 0).toLocaleString()}</td>
                  <td className="num text-success font-black">{(r.cumPoly || 0).toLocaleString()}</td>
                  <td className={cn("num transition-all", r.polyWip > 500 ? "text-danger bg-danger/10 font-black" : r.polyWip > 0 ? "text-danger" : "text-success")}>{(r.polyWip || 0).toLocaleString()}</td>
                  <td className="num text-info font-black">{(r.cumShipment || 0).toLocaleString()}</td>
                  <td className="num font-black text-fg">{(r.stock || 0).toLocaleString()}</td>
                  <td className="text-center">
                    {getRiskBadge(r.riskLevel)}
                  </td>
                  <td className="text-center no-print">
                    <button 
                      className="btn btn-o btn-s rounded-lg" 
                      onClick={() => setHistoryPO(r.poNo)}
                      title="View Entry History"
                    >
                      <Info size={12} />
                    </button>
                  </td>
                </tr>
              ))}
              {wipData.length > 0 && (
                <tr className="bg-accent/10 font-black border-t-2 border-accent/20 text-accent">
                  <td colSpan={7} className="text-right uppercase tracking-[0.2em] text-[10px] pr-6 py-4">Total WIP Summary</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.orderQty || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.cumCut || 0), 0)).toLocaleString()}</td>
                  <td className="num text-accent">
                    {Math.round((wipData.reduce((s, r) => s + (r.cumCut || 0), 0) / (wipData.reduce((s, r) => s + (r.orderQty || 0), 0) || 1)) * 100 * 10) / 10}%
                  </td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.cumSewOut || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.sewWip || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.cumWashR || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.washWip || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.cumFinIn || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.inputWip || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.cumFinOut || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.outputWip || 0), 0)).toLocaleString()}</td>
                  <td className="num text-success">{(wipData.reduce((s, r) => s + (r.cumPoly || 0), 0)).toLocaleString()}</td>
                  <td className="num text-danger">{(wipData.reduce((s, r) => s + (r.polyWip || 0), 0)).toLocaleString()}</td>
                  <td className="num text-info">{(wipData.reduce((s, r) => s + (r.cumShipment || 0), 0)).toLocaleString()}</td>
                  <td className="num text-fg">{(wipData.reduce((s, r) => s + (r.stock || 0), 0)).toLocaleString()}</td>
                  <td></td>
                  <td className="no-print"></td>
                </tr>
              )}
              {wipData.length === 0 && (
                <tr>
                  <td colSpan={24} className="py-32 text-center text-muted">
                    <BarChart3 size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-lg font-medium">No production data available for WIP tracking.</p>
                    <p className="text-sm">Add production entries to see the WIP status.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-accent/5 border border-accent/20 rounded-lg p-4 flex items-start gap-3">
          <Info size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[12px] font-bold text-accent uppercase tracking-wider">WIP Calculation Logic</p>
            <ul className="text-[10px] text-muted space-y-1 list-disc ml-4">
              <li><span className="fb">Sewing WIP</span> = Cutting - Sewing Output</li>
              <li><span className="fb">Wash WIP</span> = Sewing Output - Wash Received</li>
              <li><span className="fb">Input WIP</span> = Wash Received - Finishing Input</li>
              <li><span className="fb">Output WIP</span> = Finishing Input - Finishing Output</li>
              <li><span className="fb">Poly WIP</span> = Order Qty - Poly Entry</li>
              <li><span className="fb">Stock</span> = Poly Entry - Shipment</li>
            </ul>
          </div>
        </div>
        <div className="bg-info/5 border border-info/20 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-info shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[12px] font-bold text-info uppercase tracking-wider">Risk Assessment Logic</p>
            <ul className="text-[10px] text-muted space-y-1 list-disc ml-4">
              <li><span className="text-danger font-bold">High Risk</span>: Shipment date is within 3 days.</li>
              <li><span className="text-accent font-bold">Middle Risk</span>: Shipment date is within 6 days.</li>
              <li><span className="text-success font-bold">Safe</span>: Shipment date is more than 6 days away.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <AnimatePresence>
        {historyPO && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setHistoryPO(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between p-4 border-b border-border bg-bg2">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Clock size={18} className="text-accent" />
                    Entry History: <span className="text-accent">{historyPO}</span>
                  </h3>
                  <p className="text-[10px] text-muted">Detailed log of all production entries for this PO</p>
                </div>
                <button onClick={() => setHistoryPO(null)} className="text-muted hover:text-fg transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-8">
                {/* Line Wise Summary (Finishing) */}
                {summaries.lines.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-accent uppercase tracking-widest mb-2 flex items-center gap-2">
                      <ArrowRight size={14} /> Line-wise Finishing Summary
                    </h4>
                    <table className="et text-[10px] border-accent/20">
                      <thead className="bg-accent/5">
                        <tr>
                          <th>Color</th>
                          <th>Line No</th>
                          <th>Total Fin In</th>
                          <th>Total Fin Out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaries.lines.map((s) => (
                          <tr key={`${s.color}-${s.lineNo}`} className="hover:bg-accent/5">
                            <td className="font-bold">{s.color}</td>
                            <td className="text-accent font-bold">{s.lineNo}</td>
                            <td className="num">{(s.finIn || 0).toLocaleString()}</td>
                            <td className="num font-bold">{(s.finOut || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Floor Wise Summary (Poly) */}
                {summaries.floors.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold text-success uppercase tracking-widest mb-2 flex items-center gap-2">
                      <Database size={14} /> Floor-wise Poly Summary
                    </h4>
                    <table className="et text-[10px] border-success/20">
                      <thead className="bg-success/5">
                        <tr>
                          <th>Color</th>
                          <th>Floor</th>
                          <th>Total Poly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaries.floors.map((s) => (
                          <tr key={`${s.color}-${s.floor}`} className="hover:bg-success/5">
                            <td className="font-bold">{s.color}</td>
                            <td className="text-success font-bold">{s.floor}</td>
                            <td className="num text-success font-bold">{(s.poly || 0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Detailed Entry Log */}
                <div>
                  <h4 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Clock size={14} /> Detailed Entry Log (Daily)
                  </h4>
                  <table className="et text-[10px]">
                    <thead>
                      <tr className="bg-bg">
                        <th>Date</th>
                        <th>Color</th>
                        <th>Line No</th>
                        <th>Floor</th>
                        <th>Cutting</th>
                        <th>Sew Out</th>
                        <th>Wash Recv</th>
                        <th>Fin In</th>
                        <th>Fin Out</th>
                        <th>Poly</th>
                        <th>Shipment</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries
                        .filter(e => e.poNo === historyPO)
                        .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)))
                        .map(e => (
                          <tr key={e.id}>
                            <td className="whitespace-nowrap font-mono">{safeFormat(e.date, 'dd-MMM-yy')}</td>
                            <td className="font-bold">{e.color}</td>
                            <td className="text-accent font-bold">{e.lineNo || '—'}</td>
                            <td className="text-success font-bold">{e.floor || '—'}</td>
                            <td className="num">{(e.cut || 0).toLocaleString()}</td>
                            <td className="num">{(e.sewOut || 0).toLocaleString()}</td>
                            <td className="num">{(e.washR || 0).toLocaleString()}</td>
                            <td className="num">{(e.finIn || 0).toLocaleString()}</td>
                            <td className="num">{(e.finOut || 0).toLocaleString()}</td>
                            <td className="num text-success font-bold">{(e.poly || 0).toLocaleString()}</td>
                            <td className="num text-info font-bold">{(e.shipment || 0).toLocaleString()}</td>
                            <td>
                              {e.violations && e.violations.length > 0 ? (
                                <button 
                                  onClick={() => setSelectedError(e.violations || null)}
                                  className="text-danger flex items-center gap-1 justify-center w-full hover:bg-danger/10 py-1 rounded transition-colors"
                                >
                                  <AlertCircle size={10} /> Error
                                </button>
                              ) : (
                                <span className="text-success flex items-center gap-1 justify-center">
                                  <CheckCircle2 size={10} /> OK
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      {entries.filter(e => e.poNo === historyPO).length === 0 && (
                        <tr>
                          <td colSpan={12} className="py-10 text-center text-muted">No entries found for this PO.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="p-4 border-t border-border bg-bg2 flex justify-end">
                <button onClick={() => setHistoryPO(null)} className="btn btn-o">Close History</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Details Modal */}
      <AnimatePresence>
        {selectedError && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedError(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-danger/30 rounded-xl shadow-2xl p-5 max-w-xs w-full"
            >
              <div className="flex items-center gap-2 text-danger mb-3">
                <AlertTriangle size={18} />
                <h3 className="text-sm font-bold uppercase tracking-wider">Validation Errors</h3>
              </div>
              <div className="space-y-2 mb-4">
                {selectedError.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] bg-danger/5 p-2 rounded border border-danger/10">
                    <div className="w-1 h-1 rounded-full bg-danger mt-1.5 shrink-0" />
                    <span className="font-medium">{err}</span>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setSelectedError(null)}
                className="w-full py-2 bg-danger text-white rounded-lg text-[11px] font-bold hover:bg-danger/90 transition-colors"
              >
                Understood
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
