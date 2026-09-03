import LedgerTable from '../components/LedgerTable';
export default function LedgerPage({ customer, history, balance, onAddCredit, onAddPayment, onDelete, onPDF, onShare }: any) {
  return (
    <div className="glass-card overflow-hidden">
      <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white p-6">
        <h2 className="text-2xl font-black">{customer?.name}</h2>
        <p>ব্যালেন্স: ৳ {balance?.toLocaleString('bn-BD')}</p>
      </div>
      <div className="p-4 flex gap-2">
        <button onClick={onAddCredit} className="btn bg-amber-500 text-white">বাকি যোগ</button>
        <button onClick={onAddPayment} className="btn bg-emerald-600 text-white">জমা</button>
        <button onClick={onPDF} className="btn btn-s">PDF</button>
        <button onClick={onShare} className="btn bg-green-500 text-white">WhatsApp</button>
      </div>
      <div className="p-4"><LedgerTable history={history} onDelete={onDelete} /></div>
    </div>
  );
}
