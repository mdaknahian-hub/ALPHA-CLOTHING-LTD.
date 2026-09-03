import { useState } from 'react';
import { Save, X, CreditCard, Banknote } from 'lucide-react';
import { cn } from '../lib/utils';

type Props = {
  open: boolean;
  type: 'credit' | 'payment';
  onClose: () => void;
  onSubmit: (data: { type: 'credit' | 'payment'; amount: number; description: string; note: string; transaction_date: string }) => void;
};

export default function TransactionForm({ open, type: initialType, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({ type: initialType, amount: '', description: '', note: '', transaction_date: new Date().toISOString().slice(0,10) });
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-xl font-black flex items-center gap-2">{form.type === 'credit' ? <><CreditCard size={18} className="text-amber-600" /> বাকি দেওয়া</> : <><Banknote size={18} className="text-emerald-600" /> টাকা জমা</>}</h3>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-bg2 flex items-center justify-center"><X size={16} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, amount: Number(form.amount), type: form.type }); }} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-bg2 rounded-xl">
            <button type="button" onClick={() => setForm({ ...form, type: 'credit' })} className={cn("py-2.5 rounded-xl font-bold text-sm", form.type === 'credit' ? "bg-amber-500 text-white" : "text-muted")}>বাকি</button>
            <button type="button" onClick={() => setForm({ ...form, type: 'payment' })} className={cn("py-2.5 rounded-xl font-bold text-sm", form.type === 'payment' ? "bg-emerald-600 text-white" : "text-muted")}>জমা</button>
          </div>
          <input type="date" className="fi" value={form.transaction_date} onChange={e => setForm({ ...form, transaction_date: e.target.value })} required />
          <input type="number" className="fi" placeholder="টাকার পরিমাণ" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
          <input className="fi" placeholder="বিবরণ" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <textarea className="fi min-h-[70px]" placeholder="নোট" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          <div className="flex gap-3"><button type="button" onClick={onClose} className="flex-1 btn btn-s">বাতিল</button><button type="submit" className="flex-1 btn bg-sky-600 text-white"><Save size={16} /> সংরক্ষণ</button></div>
        </form>
      </div>
    </div>
  );
}
