import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  Download, 
  FileDown, 
  ChevronDown, 
  ChevronUp, 
  ChevronsUpDown,
  Printer,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isValid, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Order } from '../types';
import { cn, safeFormat } from '../lib/utils';
import * as XLSX from 'xlsx';

interface ShipmentScheduleProps {
  orders: Order[];
}

export default function ShipmentSchedule({ orders }: ShipmentScheduleProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState(''); // YYYY-MM
  const [filterBuyer, setFilterBuyer] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' } | null>({
    key: 'shipDate',
    direction: 'asc'
  });

  const buyers = useMemo(() => Array.from(new Set(orders.map(o => o.buyer))).sort(), [orders]);
  const styles = useMemo(() => Array.from(new Set(orders.map(o => o.style))).sort(), [orders]);

  const filteredOrders = useMemo(() => {
    const rawFiltered = orders.filter(o => {
      const matchesSearch = o.poNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.style.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          o.buyer.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesBuyer = filterBuyer ? o.buyer === filterBuyer : true;
      const matchesStyle = filterStyle ? o.style === filterStyle : true;
      
      let matchesMonth = true;
      if (filterMonth && o.shipDate) {
        const orderDate = parseISO(o.shipDate);
        const [year, month] = filterMonth.split('-').map(Number);
        matchesMonth = orderDate.getFullYear() === year && (orderDate.getMonth() + 1) === month;
      }

      return matchesSearch && matchesBuyer && matchesStyle && matchesMonth;
    });

    // Step 1: Aggregate by PO No (One row per PO)
    const poSummary: Record<string, any> = {};
    
    rawFiltered.forEach(o => {
      if (!poSummary[o.poNo]) {
        poSummary[o.poNo] = {
          shipDate: o.shipDate || '9999-12-31',
          buyer: o.buyer,
          style: o.style,
          poNo: o.poNo,
          colors: [o.color],
          totalQty: o.orderQty
        };
      } else {
        if (!poSummary[o.poNo].colors.includes(o.color)) {
          poSummary[o.poNo].colors.push(o.color);
        }
        poSummary[o.poNo].totalQty += o.orderQty;
        if (o.shipDate && o.shipDate < poSummary[o.poNo].shipDate) {
          poSummary[o.poNo].shipDate = o.shipDate;
        }
      }
    });

    // Step 2: Sort the aggregated POs globally: Date -> Buyer -> Style
    const sortedPOs = Object.values(poSummary).sort((a, b) => {
      if (a.shipDate !== b.shipDate) {
        return a.shipDate.localeCompare(b.shipDate);
      }
      if (a.buyer !== b.buyer) {
        return a.buyer.localeCompare(b.buyer);
      }
      return a.style.localeCompare(b.style);
    });

    // Step 3: Insert Sub-totals and Build Final List
    const finalItems: any[] = [];
    let currentGroupDate = '';
    let currentGroupTotal = 0;

    sortedPOs.forEach((po, idx) => {
      const poDate = po.shipDate;

      // Group change logic
      if (idx > 0 && poDate !== currentGroupDate) {
        // Push sub-total for the previous date
        finalItems.push({
          type: 'subtotal',
          date: currentGroupDate,
          totalQty: currentGroupTotal,
          id: `subtotal-${currentGroupDate}`
        });
        currentGroupTotal = 0;
      }

      // Initialize group date if empty
      if (!currentGroupDate || poDate !== currentGroupDate) {
        currentGroupDate = poDate;
      }

      // Add PO row
      finalItems.push({ type: 'po-row', ...po });
      currentGroupTotal += po.totalQty;

      // Last item case
      if (idx === sortedPOs.length - 1) {
        finalItems.push({
          type: 'subtotal',
          date: currentGroupDate,
          totalQty: currentGroupTotal,
          id: `subtotal-${currentGroupDate}-end`
        });
      }
    });

    return finalItems;
  }, [orders, searchTerm, filterMonth, filterBuyer, filterStyle]);

  const exportToPDF = async () => {
    try {
      const jspdfMod = await import('jspdf');
      const jsPDFConstructor = (jspdfMod.jsPDF || (jspdfMod as any).default || jspdfMod) as any;
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDFConstructor('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("ALPHA CLOTHING LTD.", 15, 15);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("SHIPMENT SCHEDULE REPORT", 15, 22);
      
      doc.setFontSize(8);
      doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth - 15, 22, { align: 'right' });

      const headers = [["#", "Ship Date", "Buyer", "Style", "PO No", "Colors", "Qty"]];
      const body: any[] = [];

      let serialCounter = 1;
      filteredOrders.forEach((item) => {
        if (item.type === 'subtotal') {
          body.push([
            { 
              content: `Daily Total (${item.date && item.date !== '9999-12-31' ? format(parseISO(item.date), 'dd-MMM-yy') : '—'}):`, 
              colSpan: 6, 
              styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } 
            },
            { 
              content: item.totalQty.toLocaleString(), 
              styles: { fontStyle: 'bold', halign: 'center', fillColor: [240, 240, 240] } 
            }
          ]);
        } else if (item.type === 'po-row') {
          body.push([
            serialCounter++,
            item.shipDate && item.shipDate !== '9999-12-31' ? format(parseISO(item.shipDate), 'dd-MMM-yy') : '—',
            item.buyer,
            item.style,
            item.poNo,
            item.colors.join(', '),
            item.totalQty.toLocaleString()
          ]);
        }
      });

      const grandTotal = filteredOrders
        .filter(i => i.type === 'po-row')
        .reduce((sum, i) => sum + i.totalQty, 0);
      
      body.push([{ content: 'GRAND TOTAL:', colSpan: 6, styles: { halign: 'right', fontStyle: 'bold', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }, { content: grandTotal.toLocaleString(), styles: { fontStyle: 'bold', halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255] } }]);

      autoTable(doc, {
        head: headers,
        body: body,
        startY: 35,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      });

      doc.save(`Shipment_Schedule_${format(new Date(), 'ddMMMyy')}.pdf`);
    } catch (error) {
      console.error('PDF Error:', error);
      alert('Failed to generate PDF');
    }
  };

  const exportToExcel = () => {
    const header = [
      ["ALPHA CLOTHING LTD."],
      ["SHIPMENT SCHEDULE REPORT"],
      [`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`],
      ["Filters:", `Month: ${filterMonth || 'All'}`, `Buyer: ${filterBuyer || 'All'}`, `Style: ${filterStyle || 'All'}`],
      []
    ];

    const colHeaders = ["#", "Ship Date", "Buyer", "Style", "PO No", "Colors", "Order Qty"];
    const rows: any[] = [];

    let serialCounter = 1;
    filteredOrders.forEach(item => {
      if (item.type === 'subtotal') {
        rows.push([
          '', 
          `DAILY TOTAL (${item.date && item.date !== '9999-12-31' ? format(parseISO(item.date), 'dd-MMM-yyyy') : '—'})`,
          '', '', '', '', 
          item.totalQty
        ]);
      } else if (item.type === 'po-row') {
        rows.push([
          serialCounter++,
          item.shipDate && item.shipDate !== '9999-12-31' ? format(parseISO(item.shipDate), 'dd-MMM-yyyy') : '—',
          item.buyer,
          item.style,
          item.poNo,
          item.colors.join(', '),
          item.totalQty
        ]);
      }
    });

    const grandTotal = filteredOrders
      .filter(i => i.type === 'po-row')
      .reduce((sum, i) => sum + i.totalQty, 0);
    
    rows.push([]);
    rows.push(['', '', '', '', 'GRAND TOTAL', grandTotal]);

    const worksheet = XLSX.utils.aoa_to_sheet([...header, colHeaders, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Shipment Schedule");
    
    XLSX.writeFile(workbook, `Shipment_Schedule_${format(new Date(), 'ddMMMyy_HHmm')}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print border-b border-border/10 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20 text-accent">
            <CalendarIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Shipment Schedule</h2>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                    isFiltersOpen 
                      ? "bg-accent text-white border-accent shadow-[0_0_15px_rgba(var(--accent),0.3)]" 
                      : "bg-white/5 border-white/10 text-muted hover:text-fg hover:bg-white/10"
                  )}
                  title="Toggle Global Filters"
                >
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted font-black tracking-[0.2em] uppercase mt-1">Master Delivery Planning & Tracking</p>
          </div>
        </div>
             <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="relative no-print">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
              <input
                type="text"
                placeholder="Search schedule..."
                className="fi pl-9 h-9 w-40 lg:w-48 bg-white/5 border-white/5 text-[11px] rounded-xl focus:ring-accent/20"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="btn btn-o h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2 bg-white/5 border-white/5" onClick={exportToPDF}>
              <Download size={14} /> PDF
            </button>
            <button className="btn btn-p h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest gap-2" onClick={exportToExcel}>
              <FileSpreadsheet size={14} /> Excel
            </button>
          </div>
        </div>
      </div>

      {/* Filters (Floating Panel) */}
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-wrap items-center gap-4 p-4 bg-bg2/40 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl relative z-40 no-print"
          >
            <div className="relative">
              <CalendarIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input 
                type="month" 
                className="fi pl-10 h-10 text-xs bg-white/5" 
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
            </div>

            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select 
                className="fi pl-10 h-10 text-xs bg-white/5" 
                value={filterBuyer}
                onChange={(e) => setFilterBuyer(e.target.value)}
              >
                <option value="">All Buyers</option>
                {buyers.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <select 
                className="fi pl-10 h-10 text-xs bg-white/5" 
                value={filterStyle}
                onChange={(e) => setFilterStyle(e.target.value)}
              >
                <option value="">All Styles</option>
                {styles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <button 
              className="h-10 w-10 bg-white/5 hover:bg-white/10 text-muted hover:text-fg rounded-xl flex items-center justify-center transition-all border border-white/10 ml-auto"
              onClick={() => {
                setSearchTerm('');
                setFilterMonth('');
                setFilterBuyer('');
                setFilterStyle('');
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Table */}
      <div className="bg-bg2/40 border border-border rounded-[32px] overflow-hidden shadow-2xl backdrop-blur-3xl print-m-0">
        <div className="overflow-x-auto max-h-[70vh] custom-scrollbar">
          <table className="et text-[11px] min-w-[900px] md:min-w-full">
            <thead className="sticky top-0 bg-bg2 z-20">
              <tr>
                <th className="w-12">#</th>
                <th className="text-left pr-4">Ship Date</th>
                <th className="text-left">Buyer</th>
                <th className="text-left">Style</th>
                <th className="px-6 text-center">PO No</th>
                <th className="text-center">Colors</th>
                <th className="px-6 text-center">Order Qty</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let serialCounter = 1;
                return filteredOrders.map((item, idx) => {
                  if (item.type === 'subtotal') {
                    return (
                      <tr key={item.id} className="bg-accent/5 font-black border-l-2 border-accent">
                        <td colSpan={6} className="py-2 px-10 text-right uppercase tracking-widest text-[9px] text-accent">
                          Daily Total ({item.date && item.date !== '9999-12-31' ? format(parseISO(item.date), 'dd MMM yyyy') : 'No Date'}):
                        </td>
                        <td className="num text-accent text-center bg-accent/10 py-2">
                          {item.totalQty.toLocaleString()}
                        </td>
                      </tr>
                    );
                  }

                  const rowSerial = serialCounter++;
                  return (
                    <tr key={`po-${item.poNo}-${idx}`} className="hover:bg-white/5 transition-colors border-b border-border/10 group">
                      <td className="num opacity-30 text-center">{rowSerial}</td>
                      <td className="font-bold text-fg whitespace-nowrap">
                        {item.shipDate && item.shipDate !== '9999-12-31' ? format(parseISO(item.shipDate), 'dd MMM yyyy') : '—'}
                      </td>
                      <td className="text-left font-black">{item.buyer}</td>
                      <td className="text-left font-mono opacity-80">{item.style}</td>
                      <td className="font-black text-indigo-400 font-mono text-center">{item.poNo}</td>
                      <td className="opacity-80 text-center italic">{item.colors.join(', ')}</td>
                      <td className="num font-black text-white text-center">{(item.totalQty || 0).toLocaleString()}</td>
                    </tr>
                  );
                });
              })()}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center text-muted italic opacity-50">
                    No shipments matched the criteria.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="bg-bg2/90 backdrop-blur-md font-black">
                <tr className="border-t-2 border-accent">
                  <td colSpan={6} className="text-right py-6 px-10 uppercase tracking-[0.2em] text-sm text-fg">
                    Grand Total Order Quantity:
                  </td>
                  <td className="num text-accent text-xl py-6 text-center">
                    {filteredOrders
                      .filter(i => i.type === 'po-row')
                      .reduce((sum, i) => sum + i.totalQty, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
      {/* Summary Section (Print Only) */}
      <div className="hidden print:block mt-8 border-t-2 border-border pt-4">
        <div className="flex justify-between items-center">
          <p className="text-[10px] text-muted uppercase">Authorized Signature</p>
          <p className="text-[10px] text-muted uppercase font-black tracking-widest">Alpha Clothing Ltd - Production Team</p>
        </div>
      </div>
    </div>
  );
}
