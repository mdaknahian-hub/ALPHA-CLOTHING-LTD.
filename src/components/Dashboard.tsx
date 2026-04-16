import React, { useMemo } from 'react';
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
  Legend
} from 'recharts';
import { 
  LayoutDashboard, 
  Scissors, 
  Shirt, 
  Box, 
  Target, 
  ClipboardList,
  TrendingUp,
  Activity,
  Users
} from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO } from 'date-fns';

interface DashboardProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
}

const COLORS = ['#f59e0b', '#14b8a6', '#06b6d4', '#ef4444', '#8b5cf6', '#ec4899', '#84cc16', '#f97316'];

export default function Dashboard({ orders, entries, getPOInfo }: DashboardProps) {
  const stats = useMemo(() => {
    let totalCut = 0, totalSewOut = 0, totalWashR = 0, totalFinOut = 0, totalPoly = 0, totalShipment = 0, totalOrderQty = 0;
    const buyerPoly: { [key: string]: number } = {};
    const buyerQty: { [key: string]: number } = {};
    const dailyData: { [key: string]: { date: string, cut: number, poly: number, shipment: number } } = {};
    const opTotals = { Cutting: 0, Sewing: 0, Wash: 0, Finishing: 0, Poly: 0, Shipment: 0 };

    entries.forEach(e => {
      totalCut += (e.cut || 0);
      totalSewOut += (e.sewOut || 0);
      totalWashR += (e.washR || 0);
      totalFinOut += (e.finOut || 0);
      totalPoly += (e.poly || 0);
      totalShipment += (e.shipment || 0);

      const info = getPOInfo(e.poNo);
      const b = info?.buyer || 'Unknown';
      buyerPoly[b] = (buyerPoly[b] || 0) + (e.poly || 0);
      
      if (!dailyData[e.date]) {
        dailyData[e.date] = { date: e.date, cut: 0, poly: 0, shipment: 0 };
      }
      dailyData[e.date].cut += (e.cut || 0);
      dailyData[e.date].poly += (e.poly || 0);
      dailyData[e.date].shipment += (e.shipment || 0);

      opTotals.Cutting += (e.cut || 0);
      opTotals.Sewing += (e.sewOut || 0);
      opTotals.Wash += (e.washR || 0);
      opTotals.Finishing += (e.finOut || 0);
      opTotals.Poly += (e.poly || 0);
      opTotals.Shipment += (e.shipment || 0);
    });

    // Calculate total order quantity from all orders (PO+Color combinations)
    orders.forEach(o => {
      totalOrderQty += o.orderQty;
      buyerQty[o.buyer] = (buyerQty[o.buyer] || 0) + o.orderQty;
    });

    const uniquePOs = Array.from(new Set(entries.map(e => e.poNo)));

    const overallAch = totalOrderQty ? Math.round((totalPoly / totalOrderQty) * 100 * 10) / 10 : 0;
    const overallShipAch = totalPoly ? Math.round((totalShipment / totalPoly) * 100 * 10) / 10 : 0;

    // Order Status Visuals Data
    const orderStatusData = orders.map(o => {
      const poEntries = entries.filter(e => e.poNo === o.poNo && e.color === o.color);
      const poly = poEntries.reduce((s, e) => s + (e.poly || 0), 0);
      const shipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0);
      const ach = o.orderQty ? Math.round((poly / o.orderQty) * 100) : 0;
      const shipAch = poly ? Math.round((shipment / poly) * 100) : 0;
      
      return {
        ...o,
        poly,
        shipment,
        ach,
        shipAch,
        stock: poly - shipment
      };
    }).sort((a, b) => b.ach - a.ach);

    const buyerChartData = Object.keys(buyerPoly).map(b => ({
      name: b,
      poly: buyerPoly[b],
      ach: buyerQty[b] ? Math.round((buyerPoly[b] / buyerQty[b]) * 100 * 10) / 10 : 0
    })).sort((a, b) => b.poly - a.poly);

    const trendChartData = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d,
      displayDate: safeFormat(d.date, 'dd-MMM-yy')
    }));

    const opChartData = Object.entries(opTotals).map(([name, value]) => ({ name, value }));

    return {
      totalCut, totalSewOut, totalPoly, totalShipment, overallAch, overallShipAch, activePOs: uniquePOs.length,
      buyerChartData, trendChartData, opChartData, orderStatusData
    };
  }, [entries, getPOInfo]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <LayoutDashboard size={20} className="text-accent" />
            Production Dashboard
          </h2>
          <p className="text-[11px] text-muted">Real-time performance metrics and production trends</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Cutting', value: stats.totalCut, icon: Scissors, color: 'accent', formula: '=SUM(Cut)' },
          { label: 'Total Sewing Out', value: stats.totalSewOut, icon: Shirt, color: 'teal', formula: '=SUM(SewOut)' },
          { label: 'Total Poly Entry', value: stats.totalPoly, icon: Box, color: 'info', formula: '=SUM(Poly)', highlight: true },
          { label: 'Total Shipment', value: stats.totalShipment, icon: Activity, color: 'teal', formula: '=SUM(Shipment)' },
          { label: 'Overall Achievement', value: `${stats.overallAch}%`, icon: Target, color: 'danger', formula: '=Poly/OrderQty', ach: stats.overallAch },
          { label: 'Active Orders', value: stats.activePOs, icon: ClipboardList, color: 'purple', formula: '=UNIQUE(PO)' },
        ].map((kpi, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 relative overflow-hidden group hover:translate-y-1 transition-all shadow-lg">
            <div className={cn("absolute top-0 left-0 right-0 h-1 bg-gradient-to-r", 
              kpi.color === 'accent' && "from-accent to-accent2",
              kpi.color === 'teal' && "from-teal to-emerald-400",
              kpi.color === 'info' && "from-info to-cyan-400",
              kpi.color === 'danger' && "from-danger to-red-400",
              kpi.color === 'purple' && "from-purple-500 to-violet-400"
            )} />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon size={16} className={cn(
                kpi.color === 'accent' && "text-accent",
                kpi.color === 'teal' && "text-teal",
                kpi.color === 'info' && "text-info",
                kpi.color === 'danger' && "text-danger",
                kpi.color === 'purple' && "text-purple-500"
              )} />
            </div>
            <div className={cn(
              "text-2xl font-black num",
              kpi.highlight && "text-success",
              kpi.ach !== undefined && (kpi.ach >= 80 ? "text-success" : kpi.ach >= 50 ? "text-accent" : "text-danger")
            )}>
              {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
            </div>
            <div className="mt-2">
              <span className="fb">{kpi.formula}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Buyer-wise Poly Output */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-fg uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} className="text-accent" />
              Buyer-wise Poly Output <span className="fb ml-1">SUMIF</span>
            </h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buyerChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => val >= 1000 ? `${(val/1000).toFixed(1)}k` : val}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161e2a', border: '1px solid #1f2d3d', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                  cursor={{ fill: 'rgba(245, 158, 11, 0.05)' }}
                />
                <Bar dataKey="poly" radius={[4, 4, 0, 0]}>
                  {stats.buyerChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Production Trend */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-fg uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} className="text-info" />
              Daily Production Trend <span className="fb ml-1">GROUP BY</span>
            </h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendChartData}>
                <defs>
                  <linearGradient id="colorPoly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" vertical={false} />
                <XAxis 
                  dataKey="displayDate" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161e2a', border: '1px solid #1f2d3d', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="poly" 
                  stroke="#06b6d4" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPoly)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operation-wise Output */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-fg uppercase tracking-widest flex items-center gap-2">
              <Users size={14} className="text-teal" />
              Operation-wise Output <span className="fb ml-1">SUM</span>
            </h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.opChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.opChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161e2a', border: '1px solid #1f2d3d', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  iconType="circle"
                  formatter={(value) => <span className="text-[10px] text-muted uppercase font-bold">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Achievement by Buyer */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[11px] font-bold text-fg uppercase tracking-widest flex items-center gap-2">
              <Target size={14} className="text-danger" />
              Achievement by Buyer <span className="fb ml-1">%</span>
            </h3>
          </div>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.buyerChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2d3d" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  domain={[0, 100]}
                />
                <YAxis 
                  dataKey="name" 
                  type="category"
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false} 
                  axisLine={false}
                  width={80}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#161e2a', border: '1px solid #1f2d3d', borderRadius: '8px' }}
                  itemStyle={{ fontSize: '12px', fontFamily: 'JetBrains Mono' }}
                  formatter={(value) => [`${value}%`, 'Achievement']}
                />
                <Bar dataKey="ach" radius={[0, 4, 4, 0]}>
                  {stats.buyerChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.ach >= 80 ? '#10b981' : entry.ach >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
