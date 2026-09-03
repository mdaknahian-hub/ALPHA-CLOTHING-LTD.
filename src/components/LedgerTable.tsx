import { TransactionWithBalance } from '../types';
import { Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function LedgerTable({ history, onDelete }: { history: TransactionWithBalance[]; onDelete: (id: string) => void }) {
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('bn-BD'); } catch { return s; } };
  return (
    <div className="overflow-x-auto">
      <table className="et">
        <thead><tr><th>তারিখ</th><th>বিবরণ</th><th>ধরন</th><th>টাকা</th><th>ব্যালেন্স</th><th>নোট</th><th>অ্যাকশন</th></tr></thead>
        <tbody>
          {[...history].reverse().map(t => (
            <tr key={t.id}>
              <td className="whitespace-nowrap text-xs">{fmtDate(t.transaction_date)}</td>
              <td className="max-w-[180px] truncate font-medium">{t.description}</td>
              <td><span className={cn("px-2 py-1 rounded-full text-xs font-bold", t.type === 'credit' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{t.type === 'credit' ? 'বাকি' : 'জমা'}</span></td>
              <td className={cn("font-black", t.type === 'credit' ? "text-amber-600" : "text-emerald-600")}>৳ {t.amount.toLocaleString('bn-BD')}</td>
              <td className="font-bold">৳ {t.balance.toLocaleString('bn-BD')}</td>
              <td className="max-w-[120px] truncate text-xs text-muted">{t.note || '—'}</td>
              <td><button onClick={() => onDelete(t.id)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><Trash2 size={12} /></button></td>
            </tr>
          ))}
          {history.length === 0 && <tr><td colSpan={7} className="py-10 text-muted">কোনো লেনদেন নেই</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
