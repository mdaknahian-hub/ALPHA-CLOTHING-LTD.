import { Phone, MapPin, Mail, Eye, Edit2, Trash2 } from 'lucide-react';
import { Customer } from '../types';

type Props = {
  customer: Customer & { balance: number; transactionCount: number };
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export default function CustomerCard({ customer, onView, onEdit, onDelete }: Props) {
  const bal = customer.balance;
  return (
    <div className="glass-card p-4 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black">{customer.name.charAt(0)}</div>
          <div>
            <div className="font-black">{customer.name}</div>
            <div className="text-xs text-muted flex items-center gap-1"><Phone size={11} /> {customer.phone}</div>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-black ${bal > 0 ? "bg-amber-100 text-amber-700" : bal < 0 ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>{bal > 0 ? 'বাকি' : bal < 0 ? 'অগ্রিম' : 'পরিশোধ'}</span>
      </div>
      {customer.address && <div className="text-xs text-muted flex items-center gap-1 mb-1"><MapPin size={11} /> {customer.address}</div>}
      {customer.email && <div className="text-xs text-muted flex items-center gap-1 mb-3"><Mail size={11} /> {customer.email}</div>}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="p-2.5 rounded-xl bg-bg2 text-center"><div className="text-[11px] font-bold text-muted">বাকি</div><div className={`font-black ${bal > 0 ? "text-amber-600" : "text-emerald-600"}`}>৳ {bal.toLocaleString('bn-BD')}</div></div>
        <div className="p-2.5 rounded-xl bg-bg2 text-center"><div className="text-[11px] font-bold text-muted">লেনদেন</div><div className="font-black">{customer.transactionCount} টি</div></div>
      </div>
      <div className="flex gap-2 mt-auto">
        <button onClick={onView} className="flex-1 btn btn-p py-2.5 text-xs"><Eye size={14} /> খাতা দেখুন</button>
        <button onClick={onEdit} className="w-10 h-10 rounded-xl bg-bg2 border border-border flex items-center justify-center"><Edit2 size={14} /></button>
        <button onClick={onDelete} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
