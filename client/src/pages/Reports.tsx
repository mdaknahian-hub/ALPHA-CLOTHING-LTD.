export default function ReportsPage({ filtered, period, setPeriod }: any) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 p-1 bg-bg2 rounded-xl w-fit">
        <button onClick={()=>setPeriod('daily')} className={`px-4 py-2 rounded-xl ${period==='daily'?'bg-card shadow':''}`}>দৈনিক</button>
        <button onClick={()=>setPeriod('weekly')} className={`px-4 py-2 rounded-xl ${period==='weekly'?'bg-card shadow':''}`}>সাপ্তাহিক</button>
        <button onClick={()=>setPeriod('monthly')} className={`px-4 py-2 rounded-xl ${period==='monthly'?'bg-card shadow':''}`}>মাসিক</button>
      </div>
      <div>রিপোর্ট: {filtered?.length} টি লেনদেন</div>
    </div>
  );
}
