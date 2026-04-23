import React, { useState, useMemo } from 'react';
import { 
  Target, 
  Search, 
  Filter, 
  X,
  Calendar, 
  Tag, 
  Box as BoxIcon, 
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
  poColorAggregates?: Record<string, any>;
}

export default React.memo(function OrderStatus({ orders, entries, getPOInfo, poColorAggregates = {} }: OrderStatusProps) {
  const [filters, setFilters] = useState({
    poNo: '',
    buyer: '',
    style: '',
    startDate: '',
    endDate: ''
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [expandedStyle, setExpandedStyle] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(30);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const s = search.toLowerCase();
      const matchSearch = !search || 
        o.poNo.toLowerCase().includes(s) || 
        o.buyer.toLowerCase().includes(s) || 
        o.style.toLowerCase().includes(s);

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
      
      return matchSearch && matchPO && matchBuyer && matchStyle && matchDate;
    });
  }, [orders, filters, search]);

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
      
      const pcKey = `${o.poNo}-${o.color}`;
      const agg = poColorAggregates[pcKey] || { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0, shipment: 0 };
      const poly = agg.poly;
      const shipment = agg.shipment;
      const sewOut = agg.sewOut;
      const cut = agg.cut;

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

    // Sort groups alphabetically by Buyer then Style
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
    }).sort((a, b) => {
      const buyerCmp = (a.buyer || '').localeCompare(b.buyer || '');
      if (buyerCmp !== 0) return buyerCmp;
      return (a.style || '').localeCompare(b.style || '');
    });
  }, [filteredOrders, entries, poColorAggregates]);

  const summaryStats = useMemo(() => {
    const totalQty = styleGroups.reduce((s, g) => s + g.orderQty, 0);
    const totalPoly = styleGroups.reduce((s, g) => s + g.poly, 0);
    const totalShip = styleGroups.reduce((s, g) => s + g.shipment, 0);
    const avgAch = styleGroups.length ? Math.round((styleGroups.reduce((s, g) => s + g.polyAch, 0) / styleGroups.length) * 10) / 10 : 0;

    return { totalQty, totalPoly, totalShip, avgAch };
  }, [styleGroups]);

  const buyers = Array.from(new Set(orders.map(o => o.buyer))).sort();
  const stylesList = Array.from(new Set(orders.map(o => o.style))).sort();

  const displayedStyleGroups = useMemo(() => {
    return styleGroups.slice(0, displayLimit);
  }, [styleGroups, displayLimit]);

  return (
    <div className="space-y-4">
      {/* Title & Unified Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent ring-1 ring-accent/20">
            <Target size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Order Status</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                    isFiltersOpen 
                      ? "bg-accent text-white border-accent shadow-[0_0_15px_rgba(var(--accent),0.3)]" 
                      : "bg-white/5 border-white/10 text-muted hover:text-fg hover:bg-white/10"
                  )}
                  title="Toggle Parameters & Filters"
                >
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted uppercase tracking-[0.2em] font-black mt-1">Style-wise Production Intelligence</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input
              type="text"
              placeholder="Filter matrix..."
              className="fi pl-9 h-10 w-48 lg:w-64 bg-white/5 border-white/5 text-[11px] rounded-xl focus:ring-accent/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Toggleable Filters Panel */}
      <div className="relative">
        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-0 right-0 z-50 mt-2 mb-6 p-5 bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl ring-1 ring-white/10 w-full md:w-[400px]"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">Filter Parameters</span>
                <button onClick={() => setIsFiltersOpen(false)} className="text-muted hover:text-fg"><X size={14} /></button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Buyer</label>
                    <select 
                      className="fi h-9 text-xs"
                      value={filters.buyer}
                      onChange={e => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
                    >
                      <option value="">All Buyers</option>
                      {buyers.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Style</label>
                    <select 
                      className="fi h-9 text-xs"
                      value={filters.style}
                      onChange={e => setFilters(prev => ({ ...prev, style: e.target.value }))}
                    >
                      <option value="">All Styles</option>
                      {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Ship Date From</label>
                    <input 
                      type="date" 
                      className="fi h-9 text-xs" 
                      value={filters.startDate}
                      onChange={e => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase ml-1">Ship Date To</label>
                    <input 
                      type="date" 
                      className="fi h-9 text-xs" 
                      value={filters.endDate}
                      onChange={e => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setFilters({ poNo: '', buyer: '', style: '', startDate: '', endDate: '' });
                    setSearch('');
                  }}
                  className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors"
                >
                  Reset Filters
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Bar Stats */}
        <div className="bg-bg2/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-6 flex-wrap shadow-xl ring-1 ring-white/5 no-print mb-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20 font-black text-xs uppercase">
              QTY
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-tight leading-none mb-1">Order Volume</div>
              <div className="text-lg font-black leading-none">{summaryStats.totalQty.toLocaleString()}</div>
            </div>
          </div>

          <div className="w-px h-8 bg-white/5 shrink-0" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/20 font-black text-xs uppercase">
              DONE
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-tight leading-none mb-1">Poly Complete</div>
              <div className="text-lg font-black leading-none">{summaryStats.totalPoly.toLocaleString()}</div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-white/5 shrink-0" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 ring-1 ring-indigo-500/20 font-black text-xs uppercase">
              ACH
            </div>
            <div>
               <div className="text-[10px] text-muted font-bold uppercase tracking-tight leading-none mb-1">Average Achievement</div>
               <div className={cn("text-xl font-black leading-none", summaryStats.avgAch >= 80 ? "text-success" : "text-accent")}>
                {summaryStats.avgAch}%
              </div>
            </div>
          </div>

          <div className="ml-auto no-print">
            <button className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 text-muted hover:text-fg shadow-lg" onClick={() => window.print()} title="Print Report">
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Style Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 pb-12">
        {displayedStyleGroups.length > 0 ? (
          <>
            {displayedStyleGroups.map((group) => (
              <motion.div 
                layout
                key={group.style} 
                className={cn(
                  "group relative bg-bg2/40 backdrop-blur-xl border border-white/5 rounded-3xl p-5 shadow-2xl ring-1 ring-white/5 transition-all duration-300",
                  expandedStyle === group.style ? "md:col-span-2 2xl:col-span-3 ring-accent/30 bg-bg2/60 shadow-accent/5" : "hover:bg-bg2/60"
                )}
              >
                {/* Card Header Content */}
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500",
                      expandedStyle === group.style ? "bg-accent text-white rotate-6 scale-110 shadow-lg shadow-accent/20" : "bg-accent/10 text-accent group-hover:rotate-3"
                    )}>
                      <Shirt size={24} />
                    </div>
                    <div>
                      <div className="text-[11px] font-black text-accent uppercase tracking-widest leading-none mb-1.5">{group.buyer}</div>
                      <h3 className="text-xl font-black text-white leading-none tracking-tight">{group.style}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-1 opacity-50">Avg. Progress</div>
                    <div className={cn("text-2xl font-black num leading-none", group.polyAch >= 90 ? "text-success" : "text-accent")}>
                      {group.polyAch}%
                    </div>
                  </div>
                </div>

                {/* Progress Bars Section */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black uppercase text-muted tracking-widest">Poly Entry</span>
                      <span className="text-xs font-black num text-fg">{group.poly.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(group.polyAch, 100)}%` }}
                        className={cn("h-full transition-all rounded-full shadow-[0_0_10px_rgba(var(--accent),0.3)]", group.polyAch >= 100 ? "bg-success" : "bg-accent")}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] font-black uppercase text-muted tracking-widest">Shipment</span>
                      <span className="text-xs font-black num text-fg">{group.shipment.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(group.shipAch, 100)}%` }}
                        className="h-full bg-info transition-all rounded-full shadow-[0_0_10px_rgba(var(--info),0.3)]"
                      />
                    </div>
                  </div>
                </div>

                {/* Action and Metrics Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-[8px] text-muted uppercase font-black tracking-widest mb-0.5">Stock</div>
                      <div className="text-xs font-black text-accent num">{group.stock.toLocaleString()}</div>
                    </div>
                    <div className="w-px h-6 bg-white/5" />
                    <div className="text-center">
                      <div className="text-[8px] text-muted uppercase font-black tracking-widest mb-0.5">WIP</div>
                      <div className="text-xs font-black text-muted num">{group.wip.toLocaleString()}</div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setExpandedStyle(expandedStyle === group.style ? null : group.style)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
                      expandedStyle === group.style ? "bg-accent text-white shadow-lg" : "bg-white/5 hover:bg-white/10 text-muted hover:text-fg"
                    )}
                  >
                    {expandedStyle === group.style ? 'Collapse View' : 'PO Details'}
                    <ChevronRight size={14} className={cn("transition-transform duration-300", expandedStyle === group.style && "rotate-90")} />
                  </button>
                </div>

                {/* Expanded PO View */}
                <AnimatePresence>
                  {expandedStyle === group.style && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-6 pt-6 border-t border-white/10"
                    >
                      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-bg shadow-inner custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead className="bg-white/5">
                            <tr>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest">PO & Color</th>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest text-center">Ship Date</th>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest text-right">Order Qty</th>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest text-right">Poly Done</th>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest text-right">WIP</th>
                              <th className="py-2.5 px-4 text-[9px] font-black uppercase text-muted tracking-widest text-center">Efficiency</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/[0.02]">
                            {group.pos.map((po: any) => (
                              <tr key={`${po.poNo}-${po.color}`} className="hover:bg-white/[0.01]">
                                <td className="py-2 px-4">
                                  <div className="text-[10px] font-black text-accent font-mono mb-0.5">{po.poNo}</div>
                                  <div className="text-[9px] text-muted font-bold opacity-60">{po.color}</div>
                                </td>
                                <td className="py-2 px-4 text-center text-[9px] font-mono italic opacity-60">
                                  {safeFormat(po.shipDate, 'dd-MMM-yy')}
                                </td>
                                <td className="py-2 px-4 text-right text-xs font-black text-fg num">
                                  {po.orderQty.toLocaleString()}
                                </td>
                                <td className="py-2 px-4 text-right text-xs font-black text-success num">
                                  {po.poly.toLocaleString()}
                                </td>
                                <td className="py-2 px-4 text-right text-xs font-black text-accent/50 num">
                                  {po.wip.toLocaleString()}
                                </td>
                                <td className="py-2 px-4">
                                  <div className="flex items-center justify-center gap-3">
                                    <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                                      <div 
                                        className={cn("h-full", po.polyAch >= 100 ? "bg-success" : "bg-accent")}
                                        style={{ width: `${Math.min(po.polyAch, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-[10px] font-black num text-fg w-8">{po.polyAch}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
            {styleGroups.length > displayLimit && (
              <div className="col-span-full py-10 text-center">
                <button 
                  onClick={() => setDisplayLimit(prev => prev + 30)}
                  className="px-10 py-4 bg-accent/10 border border-accent/20 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-accent hover:bg-accent hover:text-white transition-all shadow-xl active:scale-95"
                >
                  Load More Performance Metrics ({styleGroups.length - displayLimit} Remaining)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="col-span-full py-32 text-center bg-bg2/40 border border-dashed border-white/10 rounded-3xl">
            <div className="flex flex-col items-center gap-4 opacity-20">
               <Target size={64} className="animate-pulse" />
               <div className="space-y-1">
                 <h3 className="text-xl font-black uppercase tracking-widest">No Intelligence Data</h3>
                 <p className="text-[10px] font-mono tracking-wider">Parameters mismatched. System idling...</p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
