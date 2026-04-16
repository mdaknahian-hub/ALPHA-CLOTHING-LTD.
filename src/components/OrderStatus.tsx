import React, { useState, useMemo } from 'react';
import { 
  Target, 
  Search, 
  Filter, 
  Calendar, 
  Tag, 
  Box, 
  Activity, 
  TrendingUp,
  ChevronRight,
  Info,
  Shirt,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface OrderStatusProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
}

export default function OrderStatus({ orders, entries, getPOInfo }: OrderStatusProps) {
  const [filters, setFilters] = useState({
    poNo: '',
    buyer: '',
    style: '',
    startDate: '',
    endDate: ''
  });

  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchPO = !filters.poNo || o.poNo.toLowerCase().includes(filters.poNo.toLowerCase());
      const matchBuyer = !filters.buyer || o.buyer.toLowerCase().includes(filters.buyer.toLowerCase());
      const matchStyle = !filters.style || o.style.toLowerCase().includes(filters.style.toLowerCase());
      
      let matchDate = true;
      if (filters.startDate || filters.endDate) {
        const shipDate = parseISO(o.shipDate);
        const start = filters.startDate ? startOfDay(parseISO(filters.startDate)) : null;
        const end = filters.endDate ? endOfDay(parseISO(filters.endDate)) : null;
        
        if (start && end) {
          matchDate = isWithinInterval(shipDate, { start, end });
        } else if (start) {
          matchDate = shipDate >= start;
        } else if (end) {
          matchDate = shipDate <= end;
        }
      }
      
      return matchPO && matchBuyer && matchStyle && matchDate;
    });
  }, [orders, filters]);

  const styleGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    
    filteredOrders.forEach(o => {
      if (!groups[o.style]) {
        groups[o.style] = {
          style: o.style,
          buyer: o.buyer,
          shipDate: o.shipDate,
          orderQty: 0,
          poly: 0,
          shipment: 0,
          cut: 0,
          sewOut: 0,
          pos: []
        };
      }
      
      const poEntries = entries.filter(e => e.poNo === o.poNo && e.color === o.color);
      const poly = poEntries.reduce((s, e) => s + (e.poly || 0), 0);
      const shipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0);
      const sewOut = poEntries.reduce((s, e) => s + (e.sewOut || 0), 0);
      const cut = poEntries.reduce((s, e) => s + (e.cut || 0), 0);

      groups[o.style].orderQty += o.orderQty;
      groups[o.style].poly += poly;
      groups[o.style].shipment += shipment;
      groups[o.style].cut += cut;
      groups[o.style].sewOut += sewOut;
      
      groups[o.style].pos.push({
        ...o,
        poly,
        shipment,
        sewOut,
        cut,
        polyAch: o.orderQty ? Math.round((poly / o.orderQty) * 100 * 10) / 10 : 0,
        shipAch: poly ? Math.round((shipment / poly) * 100 * 10) / 10 : 0,
        stock: poly - shipment,
        wip: cut - poly
      });
    });

    return Object.values(groups).map(g => {
      const polyAch = g.orderQty ? Math.round((g.poly / g.orderQty) * 100 * 10) / 10 : 0;
      const shipAch = g.poly ? Math.round((g.shipment / g.poly) * 100 * 10) / 10 : 0;
      return {
        ...g,
        polyAch,
        shipAch,
        stock: g.poly - g.shipment,
        wip: g.cut - g.poly
      };
    });
  }, [filteredOrders, entries]);

  const summaryStats = useMemo(() => {
    const totalQty = styleGroups.reduce((s, g) => s + g.orderQty, 0);
    const totalPoly = styleGroups.reduce((s, g) => s + g.poly, 0);
    const totalShip = styleGroups.reduce((s, g) => s + g.shipment, 0);
    const avgAch = styleGroups.length ? Math.round((styleGroups.reduce((s, g) => s + g.polyAch, 0) / styleGroups.length) * 10) / 10 : 0;

    return { totalQty, totalPoly, totalShip, avgAch };
  }, [styleGroups]);

  const buyers = Array.from(new Set(orders.map(o => o.buyer))).sort();
  const styles = Array.from(new Set(orders.map(o => o.style))).sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Target size={20} className="text-accent" />
            Order Status Visuals (Style Wise)
          </h2>
          <p className="text-[11px] text-muted">Grouped by Style. Click on a card to view PO details.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="bg-bg2/50 backdrop-blur-sm border border-border rounded-xl px-4 py-2 flex items-center gap-4 shadow-lg ring-1 ring-white/5">
            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-black tracking-widest">Total Filtered Qty</span>
              <span className="text-sm font-black num text-fg">{summaryStats.totalQty.toLocaleString()}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-black tracking-widest">Total Poly</span>
              <span className="text-sm font-black num text-success">{summaryStats.totalPoly.toLocaleString()}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col">
              <span className="text-[9px] text-muted uppercase font-black tracking-widest">Avg. Achievement</span>
              <span className={cn("text-sm font-black num", summaryStats.avgAch >= 80 ? "text-success" : "text-accent")}>
                {summaryStats.avgAch}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-bg2/50 backdrop-blur-sm border border-border rounded-2xl p-5 shadow-xl no-print ring-1 ring-white/5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Search size={12} className="text-accent" /> Search PO No
            </label>
            <input 
              type="text" 
              className="fi h-10 rounded-xl" 
              placeholder="PO-1234..." 
              value={filters.poNo}
              onChange={e => setFilters(prev => ({ ...prev, poNo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Filter size={12} className="text-accent" /> Filter Buyer
            </label>
            <select 
              className="fi h-10 rounded-xl"
              value={filters.buyer}
              onChange={e => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
            >
              <option value="">All Buyers</option>
              {buyers.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Tag size={12} className="text-accent" /> Filter Style
            </label>
            <select 
              className="fi h-10 rounded-xl"
              value={filters.style}
              onChange={e => setFilters(prev => ({ ...prev, style: e.target.value }))}
            >
              <option value="">All Styles</option>
              {styles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Calendar size={12} className="text-accent" /> Ship From
            </label>
            <input 
              type="date" 
              className="fi h-10 rounded-xl" 
              value={filters.startDate}
              onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em] flex items-center gap-2 px-1">
              <Calendar size={12} className="text-accent" /> Ship To
            </label>
            <input 
              type="date" 
              className="fi h-10 rounded-xl" 
              value={filters.endDate}
              onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* Style Cards Grid */}
      <div className="grid grid-cols-1 gap-6">
        {styleGroups.length > 0 ? (
          styleGroups.map((group) => (
            <div key={group.style} className="bg-card/40 backdrop-blur-sm border border-border rounded-2xl overflow-hidden shadow-xl hover:shadow-accent/5 transition-all group ring-1 ring-white/5">
              {/* Card Header */}
              <div 
                className="bg-slate-800/50 border-b border-border p-5 cursor-pointer flex justify-between items-center"
                onClick={() => setExpandedStyle(expandedStyle === group.style ? null : group.style)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-inner">
                    <Shirt size={24} />
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1">STYLE</div>
                    <div className="text-lg font-black text-fg leading-none">{group.style}</div>
                  </div>
                  <div className="h-10 w-px bg-border mx-3" />
                  <div>
                    <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">BUYER</div>
                    <div className="text-sm font-bold text-fg/80">{group.buyer}</div>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Total Order</div>
                    <div className="text-base font-black num text-fg">{group.orderQty.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Poly Ach.</div>
                    <div className={cn("text-base font-black num", group.polyAch >= 100 ? "text-success" : "text-accent")}>
                      {group.polyAch}%
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-bg/50 flex items-center justify-center border border-border group-hover:border-accent/50 transition-colors">
                    <ChevronRight 
                      size={20} 
                      className={cn("text-muted transition-transform duration-300", expandedStyle === group.style && "rotate-90 text-accent")} 
                    />
                  </div>
                </div>
              </div>

              {/* Card Body (Summary) */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-8 bg-bg/20">
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-muted tracking-widest">Poly Progress</span>
                    <span className="text-xs font-black num text-accent">{group.polyAch}%</span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(group.polyAch, 100)}%` }}
                      className={cn("h-full transition-all rounded-full shadow-lg shadow-accent/20", group.polyAch >= 100 ? "bg-success" : "bg-accent")}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-muted tracking-widest">Shipment Progress</span>
                    <span className="text-xs font-black num text-info">{group.shipAch}%</span>
                  </div>
                  <div className="h-2 w-full bg-border rounded-full overflow-hidden shadow-inner">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(group.shipAch, 100)}%` }}
                      className="h-full bg-info transition-all rounded-full shadow-lg shadow-info/20"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-around col-span-2 bg-bg/40 rounded-2xl p-4 border border-border/50">
                  <div className="text-center">
                    <div className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">Poly Done</div>
                    <div className="text-base font-black text-success num">{group.poly.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">Shipped</div>
                    <div className="text-base font-black text-info num">{group.shipment.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">Stock</div>
                    <div className="text-base font-black text-accent num">{group.stock.toLocaleString()}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-muted uppercase font-black tracking-widest mb-1">WIP</div>
                    <div className="text-base font-black text-muted num">{group.wip.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              {/* Expanded Details (PO Wise) */}
              <AnimatePresence>
                {expandedStyle === group.style && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="p-4 bg-bg2/20">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                          <Box size={14} className="text-accent" />
                          PO Wise Details for {group.style}
                        </h4>
                        <button 
                          className="btn btn-o btn-s gap-1.5"
                          onClick={() => window.print()}
                        >
                          <Printer size={12} /> Print Style Report
                        </button>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-border bg-card">
                        <table className="et">
                          <thead>
                            <tr>
                              <th>PO No</th>
                              <th>Color</th>
                              <th>Ship Date</th>
                              <th className="text-right">Order Qty</th>
                              <th className="text-right">Poly Done</th>
                              <th className="text-right">Shipped</th>
                              <th className="text-right">Stock</th>
                              <th className="text-right">WIP</th>
                              <th className="text-center">Achievement</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.pos.map((po: any) => (
                              <tr key={`${po.poNo}-${po.color}`}>
                                <td className="font-mono text-[10px] font-bold text-accent">{po.poNo}</td>
                                <td className="text-[11px]">{po.color}</td>
                                <td className="text-[11px] whitespace-nowrap">{safeFormat(po.shipDate)}</td>
                                <td className="num text-right">{po.orderQty.toLocaleString()}</td>
                                <td className="num text-right text-success">{po.poly.toLocaleString()}</td>
                                <td className="num text-right text-info">{po.shipment.toLocaleString()}</td>
                                <td className="num text-right text-accent">{po.stock.toLocaleString()}</td>
                                <td className="num text-right text-muted">{po.wip.toLocaleString()}</td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                                      <div 
                                        className={cn("h-full", po.polyAch >= 100 ? "bg-success" : "bg-accent")}
                                        style={{ width: `${Math.min(po.polyAch, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-bold num w-8">{po.polyAch}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-card border border-dashed border-border rounded-xl">
            <Info size={40} className="mx-auto text-muted mb-4 opacity-20" />
            <h3 className="text-lg font-bold text-muted">No styles found matching filters</h3>
            <p className="text-sm text-muted/60">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
