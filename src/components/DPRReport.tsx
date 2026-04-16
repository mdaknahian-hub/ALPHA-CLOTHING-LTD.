import React, { useState, useMemo } from 'react';
import { FileText, Printer, Filter, Tag, Calendar } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO } from 'date-fns';

interface DPRReportProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
}

export default function DPRReport({ orders, entries, getPOInfo }: DPRReportProps) {
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [buyerFilter, setBuyerFilter] = useState('');

  const reportData = useMemo(() => {
    if (!reportDate) return [];

    // Filter entries for the selected date
    let filteredEntries = entries.filter(e => e.date === reportDate);
    
    // Filter by buyer if selected
    if (buyerFilter) {
      filteredEntries = filteredEntries.filter(e => {
        const info = getPOInfo(e.poNo);
        return info?.buyer === buyerFilter;
      });
    }

    // Group by Buyer + Style
    const groups: { [key: string]: { buyer: string; style: string; entries: ProductionEntry[] } } = {};
    
    filteredEntries.forEach(e => {
      const info = getPOInfo(e.poNo);
      if (!info) return;
      const key = `${info.buyer}||${info.style}`;
      if (!groups[key]) {
        groups[key] = { buyer: info.buyer, style: info.style, entries: [] };
      }
      groups[key].entries.push(e);
    });

    return Object.values(groups);
  }, [reportDate, buyerFilter, entries, getPOInfo]);

  const grandTotals = useMemo(() => {
    let qty = 0, cut = 0, sewOut = 0, finOut = 0, poly = 0, shipment = 0;
    
    const seenColorPOs = new Set<string>();
    
    reportData.forEach(group => {
      group.entries.forEach(e => {
        const info = getPOInfo(e.poNo);
        if (info) {
          const colorRow = info.colorRows.find(r => r.color === e.color);
          const key = `${e.poNo}||${e.color}`;
          if (colorRow && !seenColorPOs.has(key)) {
            qty += colorRow.orderQty;
            seenColorPOs.add(key);
          }
        }
        cut += (e.cut || 0);
        sewOut += (e.sewOut || 0);
        finOut += (e.finOut || 0);
        poly += (e.poly || 0);
        shipment += (e.shipment || 0);
      });
    });

    const ach = qty ? Math.round((poly / qty) * 100 * 10) / 10 : 0;
    return { qty, cut, sewOut, finOut, poly, shipment, ach };
  }, [reportData, getPOInfo]);

  const uniqueBuyers = Array.from(new Set(orders.map(o => o.buyer)));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText size={20} className="text-accent" />
            DPR Report
          </h2>
          <p className="text-[11px] text-muted">Daily Production Report - Grouped by Buyer and Style</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm">
            <Calendar size={14} className="text-accent" />
            <input 
              type="date" 
              className="bg-transparent border-none text-[12px] focus:ring-0 p-0 text-fg font-semibold" 
              value={reportDate} 
              onChange={e => setReportDate(e.target.value)} 
            />
          </div>
          <select 
            className="fi w-auto" 
            value={buyerFilter} 
            onChange={e => setBuyerFilter(e.target.value)}
          >
            <option value="">All Buyers</option>
            {uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <button className="btn btn-p" onClick={handlePrint}>
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      <div className="bg-bg2/50 backdrop-blur-xl border border-border rounded-2xl p-8 shadow-2xl max-w-[1400px] mx-auto print:shadow-none print:border-none print:p-0 ring-1 ring-white/5">
        <div className="text-center space-y-2 mb-10">
          <h1 className="text-3xl font-black tracking-tighter text-fg no-print bg-gradient-to-r from-fg to-muted bg-clip-text text-transparent">ALPHA CLOTHING LTD</h1>
          <div className="inline-flex items-center gap-3 px-6 py-2 bg-accent/10 rounded-2xl border border-accent/20 print:bg-transparent print:border-none print:p-0">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse no-print" />
            <p className="text-[14px] font-black text-accent uppercase tracking-[0.2em] print:text-fg print:text-sm">
              {reportDate ? safeFormat(reportDate, 'dd-MMM-yy') : '---'} <span className="no-print opacity-60 ml-2">| FINISHING DPR REPORT</span>
            </p>
          </div>
        </div>

        {reportData.length > 0 ? (
          <div className="space-y-10">
            {reportData.map((group) => {
              let groupQty = 0, groupCut = 0, groupSewOut = 0, groupFinOut = 0, groupPoly = 0, groupWashR = 0, groupFinIn = 0, groupShipment = 0;
              const seenPOsInGroup = new Set<string>();

              return (
                <div key={`${group.buyer}-${group.style}`} className="border border-border rounded-2xl overflow-hidden shadow-xl bg-card/30 backdrop-blur-sm">
                  <div className="bg-slate-800/50 px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                        <Tag size={16} className="text-accent" />
                      </div>
                      <span className="text-[13px] font-black uppercase tracking-widest text-fg">
                        BUYER & STYLE: <span className="text-accent">{group.buyer}</span> — <span className="text-accent2">{group.style}</span>
                      </span>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 text-[10px] font-bold text-muted uppercase tracking-tighter">
                      <span>Entries: {group.entries.length}</span>
                    </div>
                  </div>
                  <table className="et">
                    <thead>
                      <tr>
                        <th>Style</th>
                        <th>PO No</th>
                        <th>Ship Date</th>
                        <th>Color</th>
                        <th>Line No</th>
                        <th>Floor</th>
                        <th>Order Qty</th>
                        <th>Cutting Qty</th>
                        <th>Sewing Output</th>
                        <th>Wash Recv</th>
                        <th>Fin Input</th>
                        <th>Fin Output</th>
                        <th>Poly Entry</th>
                        <th>Shipment</th>
                        <th>Ach %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.entries.map((e, eIdx) => {
                        const info = getPOInfo(e.poNo);
                        if (!info) return null;
                        
                        // Find the specific color row for this entry
                        const colorRow = info.colorRows.find(r => r.color === e.color);
                        
                        if (!seenPOsInGroup.has(`${e.poNo}||${e.color}`)) {
                          groupQty += colorRow?.orderQty || 0;
                          seenPOsInGroup.add(`${e.poNo}||${e.color}`);
                        }
                        groupCut += (e.cut || 0);
                        groupSewOut += (e.sewOut || 0);
                        groupFinOut += (e.finOut || 0);
                        groupPoly += (e.poly || 0);
                        groupWashR += (e.washR || 0);
                        groupFinIn += (e.finIn || 0);
                        groupShipment += (e.shipment || 0);

                        const ach = colorRow?.orderQty ? Math.round(((e.poly || 0) / colorRow.orderQty) * 100 * 10) / 10 : 0;

                        return (
                          <tr key={e.id}>
                            <td className="text-left font-mono text-[11px]">{info.style}</td>
                            <td className="font-mono text-accent font-bold text-[11px]">{e.poNo}</td>
                            <td className="text-[11px]">{safeFormat(info.shipDate, 'dd-MMM-yy')}</td>
                            <td className="text-left">{e.color}</td>
                            <td className="text-accent font-bold text-[10px]">{e.lineNo || '—'}</td>
                            <td className="text-success font-bold text-[10px]">{e.floor || '—'}</td>
                            <td className="num">{(colorRow?.orderQty || 0).toLocaleString() || '—'}</td>
                            <td className="num">{(e.cut || 0).toLocaleString()}</td>
                            <td className="num">{(e.sewOut || 0).toLocaleString()}</td>
                            <td className="num">{(e.washR || 0).toLocaleString()}</td>
                            <td className="num">{(e.finIn || 0).toLocaleString()}</td>
                            <td className="num">{(e.finOut || 0).toLocaleString()}</td>
                            <td className="num text-success font-bold">{(e.poly || 0).toLocaleString()}</td>
                            <td className="num text-info font-bold">{(e.shipment || 0).toLocaleString()}</td>
                            <td className="num">
                              <span className={cn(
                                "font-bold",
                                ach >= 80 ? "text-success" : ach >= 50 ? "text-accent" : "text-danger"
                              )}>
                                {ach}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-total-bg/50 border-t border-total-border/30 font-bold text-accent">
                        <td colSpan={6} className="text-left py-2 px-4 uppercase tracking-widest text-[10px]">Sub Total</td>
                        <td className="num">{(groupQty || 0).toLocaleString()}</td>
                        <td className="num">{(groupCut || 0).toLocaleString()}</td>
                        <td className="num">{(groupSewOut || 0).toLocaleString()}</td>
                        <td className="num">{(groupWashR || 0).toLocaleString()}</td>
                        <td className="num">{(groupFinIn || 0).toLocaleString()}</td>
                        <td className="num">{(groupFinOut || 0).toLocaleString()}</td>
                        <td className="num">{(groupPoly || 0).toLocaleString()}</td>
                        <td className="num">{(groupShipment || 0).toLocaleString()}</td>
                        <td className="num">{groupQty ? Math.round((groupPoly / groupQty) * 100 * 10) / 10 : 0}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}

            {/* Grand Total */}
            <div className="mt-12 p-8 bg-gradient-to-br from-bg2 to-bg border border-border rounded-3xl shadow-2xl flex flex-wrap gap-x-12 gap-y-6 justify-center items-center font-mono ring-1 ring-white/5">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em]">Grand Total</span>
                <div className="h-1 w-12 bg-accent rounded-full opacity-50" />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">Order Qty</span>
                <strong className="text-xl font-black text-fg tracking-tighter">{(grandTotals.qty || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">Cutting</span>
                <strong className="text-xl font-black text-fg tracking-tighter">{(grandTotals.cut || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">Sewing</span>
                <strong className="text-xl font-black text-fg tracking-tighter">{(grandTotals.sewOut || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-muted uppercase tracking-tighter mb-1">Finishing</span>
                <strong className="text-xl font-black text-fg tracking-tighter">{(grandTotals.finOut || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-success uppercase tracking-tighter mb-1">Poly</span>
                <strong className="text-2xl font-black text-success tracking-tighter">{(grandTotals.poly || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] font-bold text-info uppercase tracking-tighter mb-1">Shipment</span>
                <strong className="text-2xl font-black text-info tracking-tighter">{(grandTotals.shipment || 0).toLocaleString()}</strong>
              </div>
              <div className="flex flex-col items-center bg-accent/10 px-6 py-3 rounded-2xl border border-accent/20">
                <span className="text-[10px] font-black text-accent uppercase tracking-widest mb-1">Achievement</span>
                <strong className={cn(
                  "text-3xl font-black tracking-tighter",
                  grandTotals.ach >= 80 ? "text-success" : grandTotals.ach >= 50 ? "text-accent" : "text-danger"
                )}>
                  {grandTotals.ach}%
                </strong>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-32 text-center text-muted">
            <FileText size={48} className="mx-auto mb-4 opacity-10" />
            <p className="text-lg font-medium">No production data found for this date.</p>
            <p className="text-sm">Select a different date or add entries in the Data Entry tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}
