import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  Filter, 
  Settings2, 
  Search,
  CheckCircle2,
  Table as TableIcon,
  ChevronRight,
  ListFilter,
  GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Order, ProductionEntry } from '../types';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import { auth } from '../firebase';

interface ReportBuilderProps {
  orders: Order[];
  entries: ProductionEntry[];
}

export default function ReportBuilder({ orders, entries }: ReportBuilderProps) {
  // Filter States
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-01'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [searchStyle, setSearchStyle] = useState('');
  const [searchBuyer, setSearchBuyer] = useState('');

  // Column Dictionary
  const MASTER_COLUMNS: Record<string, string> = {
    buyer: 'Buyer',
    style: 'Style',
    poNo: 'PO Number',
    color: 'Color',
    shipDate: 'Ship Date',
    orderQty: 'Order Qty',
    cutting: 'Cutting Qty',
    cuttingPer: 'Cutting %',
    sewing: 'Sewing Qty',
    sewingWip: 'Sewing WIP',
    wash: 'Wash Qty',
    washWip: 'Wash WIP',
    finInput: 'Finishing Input',
    finishing: 'Finishing Output',
    finishWip: 'Finish WIP',
    poly: 'Poly Qty',
    polyWip: 'Poly WIP',
    wipStatus: 'WIP Status',
    remarks: 'Remarks'
  };

  // State Management for Columns
  const [columnOrder, setColumnOrder] = useState<string[]>(Object.keys(MASTER_COLUMNS));
  const [selectedCols, setSelectedCols] = useState<string[]>([
    'buyer', 'style', 'poNo', 'color', 'orderQty', 'cutting', 'sewing', 'finishing', 'poly', 'wipStatus'
  ]);

  // Manual WIP Formula State
  const [wipFormulas, setWipFormulas] = useState<Record<string, { a: string, b: string }>>({
    sewingWip: { a: 'cutting', b: 'sewing' },
    washWip: { a: 'sewing', b: 'wash' },
    finishWip: { a: 'wash', b: 'finishing' },
    polyWip: { a: 'finishing', b: 'poly' }
  });

  const [showFormulaEditor, setShowFormulaEditor] = useState<string | null>(null);

  // Data Aggregation Logic
  const rawReportData = useMemo(() => {
    const prodMap: Record<string, Record<string, number>> = {};
    
    entries.forEach(e => {
      const date = parseISO(e.date);
      const start = startOfDay(parseISO(dateRange.start));
      const end = endOfDay(parseISO(dateRange.end));
      
      if (isWithinInterval(date, { start, end })) {
        const key = `${e.poNo}_${e.color}`;
        if (!prodMap[key]) prodMap[key] = { cutting: 0, sewing: 0, wash: 0, finIn: 0, finishing: 0, poly: 0 };
        
        prodMap[key].cutting += (e.cut || 0);
        prodMap[key].sewing += (e.sewOut || 0);
        prodMap[key].wash += (e.washR || 0);
        prodMap[key].finIn += (e.finIn || 0);
        prodMap[key].finishing += (e.finOut || 0);
        prodMap[key].poly += (e.poly || 0) + (e.shipment || 0);
      }
    });

    const data = orders.filter(o => {
      const styleMatch = !searchStyle || o.style.toLowerCase().includes(searchStyle.toLowerCase());
      const buyerMatch = !searchBuyer || o.buyer.toLowerCase().includes(searchBuyer.toLowerCase());
      return styleMatch && buyerMatch;
    }).map(o => {
      const p = prodMap[`${o.poNo}_${o.color}`] || { cutting: 0, sewing: 0, wash: 0, finIn: 0, finishing: 0, poly: 0 };
      
      const getVal = (key: string) => {
        if (key === 'cutting') return p.cutting;
        if (key === 'sewing') return p.sewing;
        if (key === 'wash') return p.wash;
        if (key === 'finishing') return p.finishing;
        if (key === 'poly') return p.poly;
        if (key === 'orderQty') return o.orderQty;
        return 0;
      };

      const sewingWip = getVal(wipFormulas.sewingWip.a) - getVal(wipFormulas.sewingWip.b);
      const washWip = getVal(wipFormulas.washWip.a) - getVal(wipFormulas.washWip.b);
      const finishWip = getVal(wipFormulas.finishWip.a) - getVal(wipFormulas.finishWip.b);
      const polyWip = getVal(wipFormulas.polyWip.a) - getVal(wipFormulas.polyWip.b);

      // WIP Status Logic
      let currentStatus = 'Ready';
      if (p.poly >= o.orderQty && o.orderQty > 0) currentStatus = 'Completed';
      else if (polyWip > 0) currentStatus = 'Packing';
      else if (finishWip > 0) currentStatus = 'Finishing';
      else if (washWip > 0) currentStatus = 'Wash';
      else if (sewingWip > 0) currentStatus = 'Sewing';
      else if (p.cutting > 0) currentStatus = 'Cutting';
      
      return {
        buyer: o.buyer,
        style: o.style,
        poNo: o.poNo,
        color: o.color,
        shipDate: o.shipDate,
        orderQty: o.orderQty,
        cutting: p.cutting,
        cuttingPer: o.orderQty > 0 ? (p.cutting / o.orderQty) * 100 : 0,
        sewing: p.sewing,
        sewingWip,
        wash: p.wash,
        washWip,
        finInput: p.finIn,
        finishing: p.finishing,
        finishWip,
        poly: p.poly,
        polyWip,
        wipStatus: currentStatus,
        remarks: ''
      };
    });

    // Sort as requested: Buyer > Style > PO > ShipDate > Color
    return data.sort((a, b) => {
      if (a.buyer !== b.buyer) return a.buyer.localeCompare(b.buyer);
      if (a.style !== b.style) return a.style.localeCompare(b.style);
      if (a.poNo !== b.poNo) return a.poNo.localeCompare(b.poNo);
      if (a.shipDate !== b.shipDate) return a.shipDate.localeCompare(b.shipDate);
      return a.color.localeCompare(b.color);
    });
  }, [orders, entries, dateRange, searchStyle, searchBuyer]);

  // Process data to inject subtotals
  const reportData = useMemo(() => {
    if (rawReportData.length === 0) return [];

    const result: any[] = [];
    
    // Check which levels are active
    const hasPO = selectedCols.includes('poNo');
    const hasStyle = selectedCols.includes('style');
    const hasBuyer = selectedCols.includes('buyer');

    // Group totals accumulators
    let poTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
    let styleTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
    let buyerTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
    let grandTotalAccum = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };

    const calculateWips = (totals: any) => {
      const getVal = (key: string) => (totals as any)[key] || 0;
      return {
        sewingWip: getVal(wipFormulas.sewingWip.a) - getVal(wipFormulas.sewingWip.b),
        washWip: getVal(wipFormulas.washWip.a) - getVal(wipFormulas.washWip.b),
        finishWip: getVal(wipFormulas.finishWip.a) - getVal(wipFormulas.finishWip.b),
        polyWip: getVal(wipFormulas.polyWip.a) - getVal(wipFormulas.polyWip.b)
      };
    };

    const createSubtotalRow = (type: 'po' | 'style' | 'buyer' | 'grand', label: string, totals: any) => {
      const wips = calculateWips(totals);
      return {
        buyer: type === 'grand' ? 'GRAND' : (type === 'buyer' ? 'BUYER TOTAL' : ''),
        style: type === 'style' ? 'STYLE TOTAL' : '',
        poNo: type === 'po' ? 'PO TOTAL' : '',
        color: label,
        shipDate: '',
        ...totals,
        ...wips,
        cuttingPer: totals.orderQty > 0 ? (totals.cutting / totals.orderQty) * 100 : 0,
        remarks: '',
        isSubtotal: true,
        subtotalType: type
      };
    };

    for (let i = 0; i < rawReportData.length; i++) {
      const current = rawReportData[i];
      const next = rawReportData[i + 1];

      result.push(current);

      // Accumulate
      [poTotal, styleTotal, buyerTotal, grandTotalAccum].forEach(t => {
        t.orderQty += current.orderQty;
        t.cutting += current.cutting;
        t.sewing += current.sewing;
        t.wash += current.wash;
        t.finInput += current.finInput;
        t.finishing += current.finishing;
        t.poly += current.poly;
      });

      // Check for breaks based on ACTIVE columns
      const poChange = hasPO && (!next || current.poNo !== next.poNo);
      const styleChange = hasStyle && (!next || current.style !== next.style);
      const buyerChange = hasBuyer && (!next || current.buyer !== next.buyer);

      if (poChange) {
        result.push(createSubtotalRow('po', `PO: ${current.poNo} TOTAL`, poTotal));
        poTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
      }

      if (styleChange) {
        result.push(createSubtotalRow('style', `STYLE: ${current.style} TOTAL`, styleTotal));
        styleTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
      }

      if (buyerChange) {
        result.push(createSubtotalRow('buyer', `BUYER: ${current.buyer} TOTAL`, buyerTotal));
        buyerTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
      }
    }

    // Add Grand Total
    result.push(createSubtotalRow('grand', 'GRAND TOTAL', grandTotalAccum));

    return result;
  }, [rawReportData, selectedCols, wipFormulas]);

  // Re-derived selected columns in stored order
  const activeCols = useMemo(() => {
    return columnOrder.filter(key => selectedCols.includes(key));
  }, [columnOrder, selectedCols]);

  const toggleColumn = (key: string) => {
    setSelectedCols(prev => {
      const isSelected = prev.includes(key);
      if (isSelected) {
        return prev.filter(k => k !== key);
      } else {
        // Selection-Based Ordering: add to end of selection
        return [...prev, key];
      }
    });

    // Mirror selection to columnOrder if it's not already there
    setColumnOrder(prev => {
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  };

  const exportToPDF = async () => {
    const element = document.getElementById('report-table-container');
    if (!element) return;

    const reportDate = format(new Date(), 'dd-MMM-yy');
    const reportTime = format(new Date(), 'hh:mm:ss a');
    const userEmail = auth.currentUser?.email?.toUpperCase() || 'SYSTEM';

    // Create a temporary container for the report with a professional header
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1400px'; 
    container.style.backgroundColor = '#ffffff';
    document.body.appendChild(container);
    
    const reportWrapper = document.createElement('div');
    reportWrapper.style.padding = '40px';
    reportWrapper.style.backgroundColor = '#ffffff';
    container.appendChild(reportWrapper);

    // Professional Header matching screenshot
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.borderBottom = '4px solid #f59e0b';
    header.style.paddingBottom = '25px';
    header.style.marginBottom = '30px';
    header.style.fontFamily = 'Arial, sans-serif';

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 20px;">
        <div style="width: 80px; height: 80px; background: #020617; border: 2px solid #f59e0b; border-radius: 15px; display: flex; items-center; justify-content: center; padding: 10px;">
           <img src="/logo-2.png" style="width: 100%; height: 100%; object-fit: contain;" onError="this.src='/logo.png'" />
        </div>
        <div style="text-align: left;">
          <h1 style="font-size: 32px; font-weight: 900; margin: 0; color: #020617; letter-spacing: -1px;">ALPHA CLOTHING LTD.</h1>
          <p style="font-size: 12px; font-weight: 800; margin: 4px 0; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px;">The Best Look Anytime Anywhere</p>
          <p style="font-size: 11px; font-weight: bold; margin: 0; color: #64748b;">Tenguri, BKSP, Ashulia, Savar, Dhaka</p>
        </div>
      </div>
      <div style="text-align: right;">
        <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #020617; text-transform: uppercase; letter-spacing: 1px;">CUSTOM PRODUCTION REPORT</h2>
        <div style="margin-top: 10px; font-size: 10px; color: #64748b; font-weight: bold;">
          <div style="color: #020617;">PREPARED BY: ${userEmail}</div>
          <div>DATE: ${reportDate} | TIME: ${reportTime}</div>
          <div style="margin-top: 4px; color: #f59e0b;">PERIOD: ${dateRange.start} TO ${dateRange.end}</div>
        </div>
      </div>
    `;
    reportWrapper.appendChild(header);

    // Clone the table
    const tableClone = element.cloneNode(true) as HTMLElement;
    
    // Style the clone for PDF
    const all = tableClone.querySelectorAll('*');
    all.forEach((el: any) => {
      el.style.backgroundColor = 'transparent';
      el.style.color = '#020617';
      el.style.borderColor = '#e2e8f0';
      
      if (el.tagName === 'TH') {
        el.style.backgroundColor = '#f8fafc';
        el.style.color = '#020617';
        el.style.borderBottom = '2px solid #f59e0b';
        el.style.padding = '12px 10px';
      }
      if (el.tagName === 'TD') {
        el.style.padding = '10px';
        el.style.borderBottom = '1px solid #f1f5f9';
      }
      // Remove any scroll-related classes or styles
      if (el.classList.contains('overflow-auto') || el.classList.contains('max-h-')) {
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
      }
    });

    reportWrapper.appendChild(tableClone);

    try {
      const html2canvasMod = await import('html2canvas');
      const html2canvas = (html2canvasMod.default || html2canvasMod) as any;
      const jspdfMod = await import('jspdf');
      const jsPDFConstructor = (jspdfMod.jsPDF || (jspdfMod as any).default || jspdfMod) as any;

      const canvas = await html2canvas(reportWrapper, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc: any) => {
          // Additional sanitization if needed
          const elements = clonedDoc.getElementsByTagName('*');
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i] as HTMLElement;
            const computed = window.getComputedStyle(el);
            const props = ['backgroundColor', 'color', 'borderColor', 'outlineColor', 'fill', 'stroke'];
            props.forEach(p => {
              const val = (computed as any)[p];
              if (val && (val.includes('oklab') || val.includes('oklch'))) {
                (el.style as any)[p] = (p === 'backgroundColor') ? 'transparent' : 'inherit';
              }
              if (el.style) {
                const inlineVal = (el.style as any)[p];
                if (inlineVal && (inlineVal.includes('oklab') || inlineVal.includes('oklch'))) {
                  (el.style as any)[p] = (p === 'backgroundColor') ? 'transparent' : 'inherit';
                }
              }
            });
          }
        }
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new (jsPDFConstructor as any)('l', 'mm', 'a4', true);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Custom_Report_${format(new Date(), 'ddMMMyy_HHmm')}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    }
  };

  const exportToExcel = () => {
    // 1. Create headers with metadata
    const header = [
      ["ALPHA CLOTHING LTD."],
      ["CUSTOM PRODUCTION REPORT"],
      [`Address: Tenguri, BKSP, Ashulia, Savar, Dhaka`],
      [`Period: ${dateRange.start} TO ${dateRange.end}`],
      [`Generated At: ${format(new Date(), 'dd MMM yyyy HH:mm:ss')}`],
      []
    ];

    // 2. Prepare column headers
    const colHeaders = activeCols.map(col => MASTER_COLUMNS[col]);

    // 3. Prepare data rows
    const dataRows = reportData.map(d => {
      return activeCols.map(col => {
        const val = (d as any)[col];
        if (col.includes('Per')) return typeof val === 'number' ? val.toFixed(2) + '%' : val;
        return val;
      });
    });

    // 4. Combine all into one sheet
    const finalData = [...header, colHeaders, ...dataRows];
    
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    
    const colSpan = activeCols.length > 0 ? activeCols.length - 1 : 5;
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: colSpan } }, // Company Name
      { s: { r: 1, c: 0 }, e: { r: 1, c: colSpan } }, // Report Title
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Report");
    XLSX.writeFile(workbook, `Report_${format(new Date(), 'ddMMMyy_HHmm')}.xlsx`);
  };

  return (
    <div className="flex flex-col gap-8 h-full min-h-[850px]">
      {/* Top Filter Section - Compact 4-in-1 Line */}
      <section className="bg-bg2/60 border border-border rounded-[32px] p-6 backdrop-blur-3xl shadow-2xl no-print">
         <div className="flex items-center gap-3 mb-6">
            <ListFilter size={20} className="text-indigo-400" />
            <h3 className="font-black uppercase tracking-widest text-[11px] text-indigo-100">Report Filters</h3>
         </div>
         
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
               <label className="text-[9px] font-black text-muted uppercase tracking-widest">Start Date</label>
               <input type="date" className="fi text-[10px] py-1.5" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
            </div>
            <div className="space-y-1.5">
               <label className="text-[9px] font-black text-muted uppercase tracking-widest">End Date</label>
               <input type="date" className="fi text-[10px] py-1.5" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
            </div>
            <div className="space-y-1.5">
               <label className="text-[9px] font-black text-muted uppercase tracking-widest">Style</label>
               <input type="text" placeholder="Search style..." className="fi text-[10px] py-1.5" value={searchStyle} onChange={(e) => setSearchStyle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
               <label className="text-[9px] font-black text-muted uppercase tracking-widest">Buyer</label>
               <input type="text" placeholder="Search buyer..." className="fi text-[10px] py-1.5" value={searchBuyer} onChange={(e) => setSearchBuyer(e.target.value)} />
            </div>
         </div>
      </section>

      <div className="flex flex-col xl:flex-row gap-8 flex-1">
        {/* Dynamic Builder Sidebar */}
        <aside className="w-full xl:w-80 space-y-6 shrink-0 no-print">
           <section className="bg-bg2/60 border border-border rounded-[32px] p-6 backdrop-blur-3xl shadow-2xl h-[600px] flex flex-col">
           <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-3">
                 <Settings2 size={20} className="text-indigo-400" />
                 <h3 className="font-black uppercase tracking-widest text-[11px] text-indigo-100">Visible Columns</h3>
              </div>
           </div>

           <div className="flex gap-2 mb-4 shrink-0 px-1">
             <button onClick={() => setSelectedCols(Object.keys(MASTER_COLUMNS))} className="flex-1 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black uppercase text-indigo-400">All</button>
             <button onClick={() => {
               setSelectedCols(['style', 'color', 'orderQty']);
               setColumnOrder(Object.keys(MASTER_COLUMNS));
             }} className="flex-1 py-1.5 rounded-lg bg-bg/50 border border-border text-[8px] font-black uppercase text-muted">Reset</button>
           </div>
           
           <Reorder.Group axis="y" values={columnOrder} onReorder={setColumnOrder} className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1 px-1">
              {columnOrder.map((key) => {
                const label = MASTER_COLUMNS[key];
                const isActive = selectedCols.includes(key);
                const isWipField = key.toLowerCase().includes('wip') && key !== 'wipStatus';

                return (
                  <div key={key}>
                    <Reorder.Item 
                      value={key}
                      className={cn(
                        "w-full group px-3 py-2.5 rounded-xl border transition-all flex items-center gap-3 cursor-grab active:cursor-grabbing",
                        isActive ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-100" : "bg-bg/40 border-border/40 text-muted opacity-60 hover:opacity-100"
                      )}
                    >
                      <GripVertical size={14} className="text-muted/40 shrink-0" />
                      <div className="flex-1 flex flex-col gap-1">
                        <button 
                          onClick={() => toggleColumn(key)}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[9px] font-black uppercase tracking-wider">{label}</span>
                          <div className={cn("w-4 h-4 rounded border flex items-center justify-center transition-all", isActive ? "bg-indigo-500 border-indigo-400" : "border-muted/50")}>
                             {isActive && <CheckCircle2 size={10} className="text-white" />}
                          </div>
                        </button>
                        
                        {isActive && isWipField && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowFormulaEditor(showFormulaEditor === key ? null : key);
                            }}
                            className="text-[8px] font-black uppercase text-indigo-400 mt-1 flex items-center gap-1 hover:text-indigo-300"
                          >
                            <Settings2 size={10} /> Custom Formula
                          </button>
                        )}
                      </div>
                    </Reorder.Item>

                    <AnimatePresence>
                      {showFormulaEditor === key && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden px-2 py-1 mb-2"
                        >
                          <div className="bg-bg border border-indigo-500/20 rounded-xl p-3 space-y-3">
                            <div className="flex items-center justify-between text-[8px] font-black uppercase text-muted">
                              <span>Formula Editor</span>
                              <button onClick={() => setShowFormulaEditor(null)} className="text-danger">Close</button>
                            </div>
                            <div className="flex items-center gap-2">
                              <select 
                                className="bg-bg2 border border-border rounded px-1 py-1 text-[9px] text-white flex-1"
                                value={wipFormulas[key]?.a}
                                onChange={(e) => setWipFormulas({...wipFormulas, [key]: { ...wipFormulas[key], a: e.target.value }})}
                              >
                                {Object.entries(MASTER_COLUMNS).filter(([k]) => !k.includes('Wip') && k !== 'wipStatus').map(([k, l]) => (
                                  <option key={k} value={k}>{l}</option>
                                ))}
                              </select>
                              <span className="text-muted font-bold">-</span>
                              <select 
                                className="bg-bg2 border border-border rounded px-1 py-1 text-[9px] text-white flex-1"
                                value={wipFormulas[key]?.b}
                                onChange={(e) => setWipFormulas({...wipFormulas, [key]: { ...wipFormulas[key], b: e.target.value }})}
                              >
                                {Object.entries(MASTER_COLUMNS).filter(([k]) => !k.includes('Wip') && k !== 'wipStatus').map(([k, l]) => (
                                  <option key={k} value={k}>{l}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
           </Reorder.Group>
        </section>
      </aside>

      {/* Main Preview Area */}
      <main className="flex-1 space-y-6 overflow-hidden flex flex-col">
        <div className="bg-bg2/80 border border-border rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-3xl h-full flex flex-col min-h-[700px]">
           <header className="p-8 border-b border-border bg-bg/40 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
              <div className="flex items-center gap-5">
                 <div className="w-14 h-14 bg-accent/20 rounded-[20px] flex items-center justify-center border border-accent/30">
                    <FileSpreadsheet size={28} className="text-accent" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight text-white">Custom Sheet Generator</h2>
                    <p className="text-[10px] text-muted font-black uppercase tracking-[0.3em]">Vertical Production Intelligence</p>
                 </div>
              </div>

              <div className="flex items-center gap-4 no-print">
                 <button 
                   onClick={exportToExcel}
                   className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black uppercase text-[10px] tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-lg active:scale-95"
                 >
                   <Download size={16} /> Export Excel
                 </button>
                 <button 
                   onClick={exportToPDF}
                   className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-accent text-slate-950 font-black uppercase text-[10px] tracking-widest hover:brightness-110 transition-all shadow-xl active:scale-95"
                 >
                   <FileSpreadsheet size={16} /> Download PDF
                 </button>
              </div>
           </header>

           <div id="report-table-container" className="flex-1 overflow-auto bg-gradient-to-b from-transparent to-bg/20">
              <table className="w-full text-left border-collapse table-auto et">
                 <thead className="sticky top-0 z-30">
                    <tr className="bg-bg2/95 backdrop-blur-xl">
                       {activeCols.map(col => (
                         <th key={col} className="px-5 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] border-b border-border border-r border-border/10 last:border-r-0 whitespace-nowrap text-center bg-bg/80">
                            {MASTER_COLUMNS[col]}
                         </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/20">
                    <AnimatePresence>
                       {reportData.map((d, i) => (
                         <motion.tr 
                           key={d.isSubtotal ? `sub_${d.subtotalType}_${i}` : `${d.poNo}_${d.color}_${i}`} 
                           initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: Math.min(i * 0.005, 0.5) }}
                           className={cn(
                             "group transition-all duration-300",
                             d.isSubtotal ? "bg-bg/40 font-black h-12" : "hover:bg-accent/[0.05]",
                             d.subtotalType === 'po' && "bg-indigo-500/5",
                             d.subtotalType === 'style' && "bg-indigo-500/10",
                             d.subtotalType === 'buyer' && "bg-accent/10",
                             d.subtotalType === 'grand' && "bg-accent/20 border-t-2 border-accent"
                           )}
                         >
                            {activeCols.map(col => {
                              const val = (d as any)[col];
                              const isQty = typeof val === 'number' && !col.includes('Per');
                              const isPer = col.includes('Per');
                              const isWip = col.includes('Wip');

                              return (
                                <td key={col} className={cn(
                                  "px-5 py-4 border-r border-border/10 last:border-r-0 whitespace-nowrap text-center text-xs font-bold",
                                  isQty ? "num font-black text-[13px] text-white" : "text-muted/80",
                                  isWip && val > 0 ? "text-accent" : "",
                                  isWip && val < 0 ? "text-danger" : "",
                                  col === 'style' && !d.isSubtotal ? "font-black uppercase text-accent" : "",
                                  d.isSubtotal && "text-indigo-200/90"
                                )}>
                                   {isPer ? `${val.toFixed(1)}%` : isQty ? val.toLocaleString() : val}
                                </td>
                              );
                            })}
                         </motion.tr>
                       ))}
                    </AnimatePresence>
                 </tbody>
              </table>

              {reportData.length === 0 && (
                <div className="py-60 flex flex-col items-center justify-center opacity-40">
                   <div className="w-20 h-20 bg-bg2 rounded-3xl flex items-center justify-center mb-6 border border-border animate-pulse">
                      <Search size={32} className="text-muted" />
                   </div>
                   <h4 className="text-lg font-black uppercase text-muted tracking-[0.3em]">Filters Returned No Data</h4>
                </div>
              )}
           </div>

           <footer className="px-10 py-6 bg-bg border-t border-border flex justify-between items-center no-print">
              <div className="flex gap-10">
                 <div className="flex flex-col">
                    <span className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Total Displayed</span>
                    <span className="text-xl font-black num leading-none text-white">{reportData.filter(d => !d.isSubtotal).length} Entries</span>
                 </div>
              </div>
              <div className="text-[10px] text-muted font-black uppercase tracking-widest opacity-50">
                 ALPHA CLOTHING LTD. PRODUCTION INTELLIGENCE v2.1
              </div>
           </footer>
        </div>
      </main>
    </div>
  </div>
);
}
