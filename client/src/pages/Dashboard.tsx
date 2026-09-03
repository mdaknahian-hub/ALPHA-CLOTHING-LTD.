import { Wallet, Users, Banknote, CreditCard, TrendingUp, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// This page is used as a reference for the modular structure.
// Main Dashboard logic lives in App.tsx for the preview demo.
export default function DashboardPage({ stats }: { stats: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5"><div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3"><Users size={18} /></div><div className="text-2xl font-black">{stats.totalCustomers}</div><div className="text-xs text-muted">মোট গ্রাহক</div></div>
        <div className="glass-card p-5"><div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3"><Wallet size={18} /></div><div className="text-2xl font-black">৳ {stats.totalDue?.toLocaleString('bn-BD')}</div><div className="text-xs text-muted">মোট বাকি</div></div>
        <div className="glass-card p-5"><div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3"><Banknote size={18} /></div><div className="text-2xl font-black text-emerald-600">৳ {stats.todayPayment?.toLocaleString('bn-BD')}</div><div className="text-xs text-muted">আজ জমা</div></div>
        <div className="glass-card p-5"><div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3"><CreditCard size={18} /></div><div className="text-2xl font-black text-rose-600">৳ {stats.todayCredit?.toLocaleString('bn-BD')}</div><div className="text-xs text-muted">আজ বাকি</div></div>
      </div>
      <div className="glass-card p-6">
        <h3 className="font-black mb-4 flex items-center gap-2"><TrendingUp size={18} /> শেষ ৭ দিন</h3>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={stats.last7}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Bar dataKey="credit" name="বাকি" fill="#f59e0b" /><Bar dataKey="payment" name="জমা" fill="#10b981" /></BarChart></ResponsiveContainer></div>
      </div>
    </div>
  );
}
