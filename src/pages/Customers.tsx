import CustomerCard from '../components/CustomerCard';
export default function CustomersPage(props: any) {
  return <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">{props.customers?.map((c:any)=>(<CustomerCard key={c.id} customer={c} onView={()=>props.onView(c.id)} onEdit={()=>props.onEdit(c)} onDelete={()=>props.onDelete(c.id)} />))}</div>;
}
