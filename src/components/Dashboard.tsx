import React, { useMemo, useState, useDeferredValue, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  PieChart, 
  Pie, 
  Cell,
  Legend,
  RadialBarChart,
  RadialBar
} from 'recharts';
import { 
  LayoutDashboard, 
  Scissors, 
  Shirt, 
  Box as BoxIcon, 
  Target, 
  ClipboardList,
  TrendingUp,
  Activity,
  Users,
  Calendar,
  ChevronRight,
  Settings2,
  Filter,
  Search,
  CheckCircle2,
  ListFilter,
  ArrowRight,
  Save,
  RotateCcw,
  Zap,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import Gauge from './Gauge';

interface DashboardProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
  poColorAggregates?: Record<string, any>;
}

const COLORS = ['#f59e0b', '#14b8a6', '#06b6d4', '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316'];

export default React.memo(function Dashboard({ orders, entries, getPOInfo, poColorAggregates = {} }: DashboardProps) {
  // --- Dashboard Filter States ---
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [searchStyle, setSearchStyle] = useState('');
  const [searchBuyer, setSearchBuyer] = useState('');

  const deferredStart = useDeferredValue(dateRange.start);
  const deferredEnd = useDeferredValue(dateRange.end);
  const deferredStyle = useDeferredValue(searchStyle);
  const deferredBuyer = useDeferredValue(searchBuyer);

  // --- Layout Customization ---
  const [visibleBlocks, setVisibleBlocks] = useState({
    overview: true,
    achievement: true,
    productionTrend: true,
    buyerAnalytics: true,
    recentStatus: true,
    gaugeMeter: true,
    aiInsights: true
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load persistence
  useEffect(() => {
    const loadConfig = async () => {
      if (!auth.currentUser) return;
      try {
        const configRef = doc(db, 'dashboard_configs', auth.currentUser.uid);
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setVisibleBlocks(configSnap.data().visibleBlocks);
        }
      } catch (err) {
        console.error("Error loading dashboard config:", err);
      }
    };
    loadConfig();
  }, []);

  const saveLayout = async () => {
    if (!auth.currentUser) return;
    setSaveStatus('saving');
    try {
      const configRef = doc(db, 'dashboard_configs', auth.currentUser.uid);
      await setDoc(configRef, {
        userId: auth.currentUser.uid,
        visibleBlocks,
        updatedAt: new Date().toISOString()
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error("Error saving layout:", err);
      setSaveStatus('idle');
    }
  };

  const resetLayout = () => {
    setVisibleBlocks({
      overview: true,
      achievement: true,
      productionTrend: true,
      buyerAnalytics: true,
      recentStatus: true,
      gaugeMeter: true,
      aiInsights: true
    });
  };

  const stats = useMemo(() => {
    let totalCut = 0, totalSewOut = 0, totalWashR = 0, totalFinOut = 0, totalPoly = 0, totalShipment = 0, totalOrderQty = 0;
    const buyerPoly: { [key: string]: number } = {};
    const buyerQty: { [key: string]: number } = {};
    const dailyData: { [key: string]: { date: string, rawDate: string, cut: number, poly: number, shipment: number } } = {};
    
    // Performance context
    const startObj = startOfDay(parseISO(deferredStart)).getTime();
    const endObj = endOfDay(parseISO(deferredEnd)).getTime();

    // Filtered entries based on range
    entries.forEach(e => {
      if (!e.date) return;
      
      // CRASH PROOF DATE PARSING
      let eTime = 0;
      try {
        const parsedNode = parseISO(e.date);
        if (isNaN(parsedNode.getTime())) {
          // Attempt alternate recovery if not ISO
          return; 
        }
        eTime = parsedNode.getTime();
      } catch {
        return;
      }

      if (eTime >= startObj && eTime <= endObj) {
        const info = getPOInfo(e.poNo);
        if (info) {
          const buyerMatch = !deferredBuyer || info.buyer.toLowerCase().includes(deferredBuyer.toLowerCase());
          const styleMatch = !deferredStyle || info.style.toLowerCase().includes(deferredStyle.toLowerCase());
          if (!buyerMatch || !styleMatch) return;
        }

        totalCut += (e.cut || 0);
        totalSewOut += (e.sewOut || 0);
        totalWashR += (e.washR || 0);
        totalFinOut += (e.finOut || 0);
        totalPoly += (e.poly || 0);
        totalShipment += (e.shipment || 0);

        const b = info?.buyer || 'Unknown';
        buyerPoly[b] = (buyerPoly[b] || 0) + (e.poly || 0);
        
        const dateKey = e.date;
        if (!dailyData[dateKey]) {
          try {
            dailyData[dateKey] = { date: format(parseISO(e.date), 'dd MMM'), rawDate: e.date, cut: 0, poly: 0, shipment: 0 };
          } catch {
            return;
          }
        }
        dailyData[dateKey].cut += (e.cut || 0);
        dailyData[dateKey].poly += (e.poly || 0);
        dailyData[dateKey].shipment += (e.shipment || 0);
      }
    });

    // Filtered orders for totals
    orders.forEach(o => {
      const buyerMatch = !deferredBuyer || o.buyer.toLowerCase().includes(deferredBuyer.toLowerCase());
      const styleMatch = !deferredStyle || o.style.toLowerCase().includes(deferredStyle.toLowerCase());
      if (!buyerMatch || !styleMatch) return;

      totalOrderQty += o.orderQty;
      buyerQty[o.buyer] = (buyerQty[o.buyer] || 0) + o.orderQty;
    });

    const trend = Object.values(dailyData).sort((a, b) => a.rawDate.localeCompare(b.rawDate));

    // Gauge Meter Data (Achievement %)
    const overallAch = totalOrderQty ? Math.round((totalPoly / totalOrderQty) * 100) : 0;
    
    const buyerChartData = Object.keys(buyerQty).map(b => ({
      name: b,
      Order: buyerQty[b],
      Production: buyerPoly[b] || 0
    })).sort((a, b) => b.Order - a.Order).slice(0, 8);

    // List of Top Orders by Achievement
    const topPerformers = orders
      .filter(o => {
          const buyerMatch = !deferredBuyer || o.buyer.toLowerCase().includes(deferredBuyer.toLowerCase());
          const styleMatch = !deferredStyle || o.style.toLowerCase().includes(deferredStyle.toLowerCase());
          return buyerMatch && styleMatch;
      })
      .map(o => {
        const pcKey = `${o.poNo}-${o.color}`;
        const agg = poColorAggregates[pcKey] || { poly: 0 };
        const ach = o.orderQty ? Math.round((agg.poly / o.orderQty) * 100) : 0;
        return { ...o, ach };
      })
      .sort((a, b) => b.ach - a.ach)
      .slice(0, 5);

    return { 
      totalCut, totalSewOut, totalPoly, totalShipment, totalOrderQty, 
      overallAch, trend, buyerChartData, topPerformers
    };
  }, [orders, entries, deferredStart, deferredEnd, deferredBuyer, deferredStyle, getPOInfo, poColorAggregates]);

  return (
    <div className="flex flex-col gap-6 min-h-[900px] mb-12">
      {/* 1. Header & Quick Toggles */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print px-1">
        <div className="flex items-center gap-4">
           <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/5">
              <LayoutDashboard size={20} className="text-accent" />
           </div>
           <div>
              <h2 className="st leading-none">Dashboard</h2>
              <div className="flex items-center gap-2 mt-1">
                 <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                 <p className="sst leading-none">Command Intelligence Matrix</p>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-3 bg-bg2/40 p-1 rounded-xl border border-border shadow-2xl">
           <div className="px-3 border-r border-border/50">
              <span className="text-[9px] font-black uppercase text-muted tracking-widest">Layout</span>
           </div>
           <div className="flex items-center gap-1 pr-2 border-r border-border mr-1">
             {(Object.keys(visibleBlocks) as Array<keyof typeof visibleBlocks>).map(key => (
               <button 
                 key={key}
                 onClick={() => setVisibleBlocks(prev => ({ ...prev, [key]: !prev[key] }))}
                 className={cn(
                   "w-8 h-8 rounded-lg transition-all active:scale-95 flex items-center justify-center",
                   visibleBlocks[key] ? "bg-accent/10 text-accent border border-accent/30 shadow-lg" : "text-muted hover:bg-white/5 border border-transparent"
                 )}
                 title={`Toggle ${String(key)}`}
               >
                  {key === 'overview' && <Activity size={14} />}
                  {key === 'gaugeMeter' && <Zap size={14} />}
                  {key === 'productionTrend' && <TrendingUp size={14} />}
                  {key === 'buyerAnalytics' && <Users size={14} />}
                  {key === 'recentStatus' && <ClipboardList size={14} />}
                  {key === 'achievement' && <CheckCircle2 size={14} />}
               </button>
             ))}
           </div>
           <div className="flex items-center gap-1">
             <button onClick={resetLayout} className="p-2 text-muted hover:text-white transition-colors" title="Reset Layout">
                <RotateCcw size={14} />
             </button>
             <button 
               onClick={saveLayout} 
               disabled={saveStatus === 'saving'}
               className={cn("flex items-center gap-2 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all", saveStatus === 'saved' ? "bg-success text-white" : "bg-accent/10 text-accent hover:bg-accent/20")}
             >
                {saveStatus === 'saving' ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : saveStatus === 'saved' ? <><CheckCircle2 size={12}/> Saved</> : <><Save size={12}/> Save</>}
             </button>
           </div>
        </div>
      </header>

      {/* 2. Global Filter Bar (Analytics Style) */}
      <section className="bg-bg2/30 backdrop-blur-md border border-white/5 rounded-3xl p-5 shadow-2xl relative overflow-hidden group no-print ring-1 ring-white/5">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Filter size={60} className="text-accent" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
             <div className="space-y-1.5 font-mono">
                <label className="text-[8px] font-black text-muted uppercase tracking-[0.3em] ml-1">Period Alpha</label>
                <div className="relative group/input">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 group-hover/input:text-accent transition-colors" size={12} />
                  <input 
                    type="date" 
                    className="fi pl-10 h-9 bg-transparent border-white/10" 
                    value={dateRange.start} 
                    onChange={(e) => setDateRange({...dateRange, start: e.target.value})} 
                  />
                </div>
             </div>
             <div className="space-y-1.5 font-mono">
                <label className="text-[8px] font-black text-muted uppercase tracking-[0.3em] ml-1">Period Omega</label>
                <div className="relative group/input">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 group-hover/input:text-accent transition-colors" size={12} />
                  <input 
                    type="date" 
                    className="fi pl-10 h-9 bg-transparent border-white/10" 
                    value={dateRange.end} 
                    onChange={(e) => setDateRange({...dateRange, end: e.target.value})} 
                  />
                </div>
             </div>
             <div className="space-y-1.5 font-mono">
                <label className="text-[8px] font-black text-muted uppercase tracking-[0.3em] ml-1">Style Vector</label>
                <div className="relative group/input">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 group-hover/input:text-accent transition-colors" size={12} />
                  <input 
                    type="text" 
                    placeholder="Vector Style ID..."
                    className="fi pl-10 h-9 bg-transparent border-white/10" 
                    value={searchStyle} 
                    onChange={(e) => setSearchStyle(e.target.value)} 
                  />
                </div>
             </div>
             <div className="space-y-1.5 font-mono">
                <label className="text-[8px] font-black text-muted uppercase tracking-[0.3em] ml-1">Buyer Entity</label>
                <div className="relative group/input">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-accent/50 group-hover/input:text-accent transition-colors" size={12} />
                  <input 
                    type="text" 
                    placeholder="Analyze Buyer..."
                    className="fi pl-10 h-9 bg-transparent border-white/10" 
                    value={searchBuyer} 
                    onChange={(e) => setSearchBuyer(e.target.value)} 
                  />
                </div>
             </div>
          </div>
      </section>

      {/* 3. Main Dashboard Bento Grid */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* AI Insight Pulse */}
        <AnimatePresence>
          {visibleBlocks.aiInsights && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="col-span-12 bg-gradient-to-br from-indigo-500/5 to-accent/5 border border-border/50 rounded-[40px] p-8 shadow-2xl relative overflow-hidden group"
            >
               <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
               
               <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-16 h-16 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Zap size={32} className="text-accent animate-pulse" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Advanced AI Intelligence</h3>
                        <p className="text-xs text-muted font-bold uppercase tracking-widest mt-1">Real-time Production Analysis Engine</p>
                     </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                     <button 
                        onClick={() => {
                          const event = new CustomEvent('ai-trigger', { detail: { prompt: "আজকের প্রোডাকশন ডাটার সামারি দিন এবং ৩টি গুরুত্বপূর্ণ পয়েন্ট হাইলাইট করুন।" } });
                          window.dispatchEvent(event);
                        }}
                        className="bg-accent text-slate-950 px-8 py-3.5 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:shadow-xl transition-all flex items-center gap-2 group/btn"
                     >
                        <Activity size={14} className="group-hover/btn:rotate-12 transition-transform" />
                        Generate Bengali Summary
                     </button>
                     <button 
                        onClick={() => {
                          const event = new CustomEvent('ai-trigger', { detail: { prompt: "Analyze efficiency and identify bottlenecks." } });
                          window.dispatchEvent(event);
                        }}
                        className="bg-bg border border-border text-white px-8 py-3.5 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-border transition-all flex items-center gap-2"
                     >
                        <TrendingUp size={14} />
                        Efficiency Check
                     </button>
                  </div>
               </div>

               <div className="mt-8 flex flex-wrap gap-12 border-t border-border/20 pt-8">
                  {[
                    { label: 'Current WIP', val: (stats.totalCut - stats.totalPoly).toLocaleString(), desc: 'Unfinished Inventory' },
                    { label: 'Order Variance', val: (stats.overallAch >= 100 ? 'Target Met' : `${Math.round(100 - stats.overallAch)}% Behind`), desc: 'Performance Delta' },
                    { label: 'Growth Scale', val: `${Math.round(stats.totalOrderQty / 1000)}k+`, desc: 'Total Managed Units' }
                  ].map((stat, idx) => (
                    <div key={idx} className="flex flex-col">
                       <span className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</span>
                       <span className="text-2xl font-black text-white num leading-none mb-1">{stat.val}</span>
                       <span className="text-[9px] font-bold text-accent/60 uppercase tracking-widest">{stat.desc}</span>
                    </div>
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {visibleBlocks.gaugeMeter && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="col-span-12 lg:col-span-4 bg-bg2/40 border border-border rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden group shadow-xl"
            >
               <h3 className="sst mb-6 tracking-[0.4em]">Efficiency Pulse</h3>
               <Gauge value={stats.overallAch} max={100} label="Production Velocity" />
               <div className="mt-8 grid grid-cols-2 gap-4 w-full border-t border-border/50 pt-6">
                  <div className="text-center">
                     <span className="block text-[8px] font-black uppercase text-muted tracking-widest mb-1">Target</span>
                     <span className="text-xl font-black text-white">{stats.totalOrderQty.toLocaleString()}</span>
                  </div>
                  <div className="text-center border-l border-border/50">
                     <span className="block text-[8px] font-black uppercase text-muted tracking-widest mb-1">Output</span>
                     <span className="text-xl font-black text-accent">{stats.totalPoly.toLocaleString()}</span>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Statistical Overview Bento Cards */}
        <AnimatePresence>
          {visibleBlocks.overview && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="col-span-12 lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4"
            >
              {[
                { label: 'Total Cutting', val: stats.totalCut, icon: Scissors, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
                { label: 'Sewing Output', val: stats.totalSewOut, icon: Shirt, color: 'text-accent', bg: 'bg-accent/10' },
                { label: 'Finishing Output', val: stats.totalPoly, icon: BoxIcon, color: 'text-teal-400', bg: 'bg-teal-400/10' },
                { label: 'Shipment Total', val: stats.totalShipment, icon: Target, color: 'text-rose-400', bg: 'bg-rose-400/10' }
              ].map((card, i) => (
                <div key={i} className="bg-bg2/40 border border-border rounded-3xl p-6 hover:bg-bg2 transition-all flex items-center gap-6 group shadow-lg">
                   <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-transparent group-hover:border-white/10 transition-all shadow-md", card.bg)}>
                      <card.icon size={24} className={card.color} />
                   </div>
                   <div className="overflow-hidden">
                      <span className="block text-[9px] font-black uppercase tracking-widest text-muted mb-1 truncate">{card.label}</span>
                      <span className="text-2xl font-black text-white num tracking-tighter leading-none block">{card.val.toLocaleString()}</span>
                   </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Production Trend Area Chart */}
        <AnimatePresence>
          {visibleBlocks.productionTrend && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="col-span-12 lg:col-span-7 bg-bg2/40 border border-border rounded-3xl p-8 min-h-[400px] flex flex-col shadow-xl"
            >
               <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                        <Activity size={16} className="text-indigo-400" />
                     </div>
                     <h3 className="sst">Daily Output Radar</h3>
                  </div>
                  <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest">
                     <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Cut</div>
                     <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-accent" /> Poly</div>
                  </div>
               </div>
               
               <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.trend}>
                      <defs>
                        <linearGradient id="colorCut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorPoly" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} dy={10} />
                      <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                      />
                      <Area type="monotone" dataKey="cut" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCut)" />
                      <Area type="monotone" dataKey="poly" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorPoly)" />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Buyer Distribution Analytics */}
        <AnimatePresence>
          {visibleBlocks.buyerAnalytics && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
               className="col-span-12 lg:col-span-5 bg-bg2/40 border border-border rounded-3xl p-8 flex flex-col shadow-xl"
             >
                <div className="flex items-center gap-3 mb-8">
                   <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20">
                      <Users size={16} className="text-teal-400" />
                   </div>
                   <h3 className="sst">Buyer Intelligence</h3>
                </div>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.buyerChartData} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e293b" />
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={9} width={80} />
                      <Tooltip 
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '10px' }}
                      />
                      <Bar dataKey="Order" fill="#334155" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="Production" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Top Order Achievements List */}
        <AnimatePresence>
          {visibleBlocks.recentStatus && (
             <motion.div 
               initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
               className="col-span-12 lg:col-span-6 bg-bg2/40 border border-border rounded-3xl p-8 flex flex-col shadow-xl relative overflow-hidden"
             >
                <h3 className="sst mb-8">Top Performers</h3>
                <div className="space-y-5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                   {stats.topPerformers.map((o, i) => (
                      <div key={i} className="flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                               <span className="text-[10px] font-black text-white uppercase tracking-wider">{o.poNo}</span>
                               <span className="text-[8px] font-bold text-muted uppercase tracking-widest">{o.buyer}</span>
                            </div>
                            <span className="text-sm font-black text-accent num">{o.ach}%</span>
                         </div>
                         <div className="w-full h-1.5 bg-bg border border-border/30 rounded-full overflow-hidden">
                            <motion.div 
                               initial={{ width: 0 }} 
                               animate={{ width: `${Math.min(o.ach, 100)}%` }}
                               transition={{ duration: 1, delay: i * 0.1 }}
                               className="h-full bg-accent rounded-full"
                            />
                         </div>
                      </div>
                   ))}
                </div>
             </motion.div>
          )}
        </AnimatePresence>

        {/* Achievement Roadmap */}
        <AnimatePresence>
          {visibleBlocks.achievement && (
            <motion.div 
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="col-span-12 lg:col-span-6 bg-bg2/40 border border-border rounded-3xl p-8 flex flex-col shadow-xl"
            >
               <h3 className="sst mb-8">Milestone Tracking</h3>
               <div className="grid grid-cols-2 gap-6 h-full items-center">
                  <div className="space-y-6">
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <span className="text-[8px] font-black uppercase text-muted tracking-widest">Global Order Target</span>
                        <div className="text-xl font-black text-fg num">{stats.totalOrderQty.toLocaleString()}</div>
                     </div>
                     <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1">
                        <span className="text-[8px] font-black uppercase text-muted tracking-widest">Realized Output</span>
                        <div className="text-xl font-black text-accent num">{stats.totalPoly.toLocaleString()}</div>
                     </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="relative w-32 h-32">
                       <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                         <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                         <motion.circle 
                           cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray="282.7" 
                           animate={{ strokeDashoffset: 282.7 - (282.7 * (stats.overallAch / 100)) }}
                           className="text-accent"
                         />
                       </svg>
                       <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black text-white leading-none num">{stats.overallAch}%</span>
                          <span className="text-[7px] text-muted font-bold uppercase tracking-widest mt-1">Velocity</span>
                       </div>
                    </div>
                  </div>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent Summary Footer */}
      <footer className="mt-auto bg-bg2/50 backdrop-blur-xl rounded-3xl border border-border p-6 flex flex-col md:flex-row items-center justify-between gap-6 no-print shadow-xl">
         <div className="flex items-center gap-6">
            <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center border-2 border-bg shadow-lg">
               <Target size={24} className="text-slate-950" />
            </div>
            <div className="flex flex-col">
               <h4 className="sst mb-1">Global Velocity</h4>
               <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-white leading-none num">{stats.overallAch}%</span>
                  <div className="w-32 h-2 bg-bg border border-border/50 rounded-full overflow-hidden">
                     <motion.div 
                        initial={{ width: 0 }} animate={{ width: `${Math.min(stats.overallAch, 100)}%` }}
                        className="h-full bg-accent rounded-full"
                     />
                  </div>
               </div>
            </div>
         </div>

         <div className="flex gap-8">
            <div className="text-right">
               <span className="block sst mb-1">Styles</span>
               <span className="text-xl font-black text-white num leading-none">{orders.length}</span>
            </div>
            <div className="text-right border-l border-border/50 pl-8">
               <span className="block sst mb-1">Efficiency</span>
               <span className="text-xl font-black text-accent num leading-none">{stats.totalPoly ? Math.round((stats.totalPoly / stats.totalCut) * 100) : 0}%</span>
            </div>
         </div>
      </footer>
    </div>
  );
});
