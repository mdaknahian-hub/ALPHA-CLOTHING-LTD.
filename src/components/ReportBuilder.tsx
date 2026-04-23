import React, { useState, useMemo, forwardRef, useImperativeHandle, useDeferredValue } from 'react';
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
  GripVertical,
  RefreshCw,
  Info
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

export interface ReportBuilderRef {
  exportToPDF: () => Promise<void>;
  exportToExcel: () => void;
}

const ReportBuilder = forwardRef<ReportBuilderRef, ReportBuilderProps>(({ orders, entries }, ref) => {
  // Filter States
  const [dateRange, setDateRange] = useState({
    start: format(new Date(), 'yyyy-MM-01'),
    end: format(new Date(), 'yyyy-MM-dd')
  });
  const [searchStyle, setSearchStyle] = useState('');
  const [searchBuyer, setSearchBuyer] = useState('');

  const deferredSearchStyle = useDeferredValue(searchStyle);
  const deferredSearchBuyer = useDeferredValue(searchBuyer);

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

  const [subtotalConfig, setSubtotalConfig] = useState({
    po: true,
    color: true,
    style: true,
    buyer: true,
    grand: true
  });

  const [displayLimit, setDisplayLimit] = useState(200);

  // Data Aggregation Logic
  const rawReportData = useMemo(() => {
    // 1. Production Mapping (Aggregation inside the interval)
    const prodMap: Record<string, Record<string, number>> = {};
    
    // Performance: Parse date range boundaries once
    const rangeStart = startOfDay(parseISO(dateRange.start)).getTime();
    const rangeEnd = endOfDay(parseISO(dateRange.end)).getTime();

    entries.forEach(e => {
      if (!e.date) return;
      const entryTime = parseISO(e.date).getTime();
      
      if (entryTime >= rangeStart && entryTime <= rangeEnd) {
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

    // 2. Dynamic Grouping Logic
    const groupingBaseCols = ['buyer', 'style', 'poNo', 'color', 'shipDate'];
    const activeGroupingCols = groupingBaseCols.filter(c => selectedCols.includes(c));
    const actualGroupingCols = activeGroupingCols.length > 0 ? activeGroupingCols : ['buyer', 'style'];

    const aggregated: Record<string, any> = {};

    orders.forEach(o => {
      // Performance: Use deferred search values for filtering orders
      const styleMatch = !deferredSearchStyle || o.style.toLowerCase().includes(deferredSearchStyle.toLowerCase());
      const buyerMatch = !deferredSearchBuyer || o.buyer.toLowerCase().includes(deferredSearchBuyer.toLowerCase());
      if (!styleMatch || !buyerMatch) return;

      const groupKey = actualGroupingCols.map(col => String((o as any)[col] || 'N/A')).join('||');
      const p = prodMap[`${o.poNo}_${o.color}`] || { cutting: 0, sewing: 0, wash: 0, finIn: 0, finishing: 0, poly: 0 };

      if (!aggregated[groupKey]) {
        aggregated[groupKey] = {
          buyer: actualGroupingCols.includes('buyer') ? o.buyer : '',
          style: actualGroupingCols.includes('style') ? o.style : '',
          poNo: actualGroupingCols.includes('poNo') ? o.poNo : '',
          color: actualGroupingCols.includes('color') ? o.color : '',
          shipDate: actualGroupingCols.includes('shipDate') ? o.shipDate : '',
          orderQty: 0,
          cutting: 0,
          sewing: 0,
          wash: 0,
          finInput: 0,
          finishing: 0,
          poly: 0,
        };
      }

      const row = aggregated[groupKey];
      row.orderQty += o.orderQty;
      row.cutting += p.cutting;
      row.sewing += p.sewing;
      row.wash += p.wash;
      row.finInput += p.finIn;
      row.finishing += p.finishing;
      row.poly += p.poly;
    });

    // 3. Final Mapping (WIPs and Sort)
    const data = Object.values(aggregated).map(row => {
      const getVal = (key: string) => {
        if (key === 'cutting') return row.cutting;
        if (key === 'sewing') return row.sewing;
        if (key === 'wash') return row.wash;
        if (key === 'finishing') return row.finishing;
        if (key === 'poly') return row.poly;
        if (key === 'orderQty') return row.orderQty;
        return 0;
      };

      const sewingWip = getVal(wipFormulas.sewingWip.a) - getVal(wipFormulas.sewingWip.b);
      const washWip = getVal(wipFormulas.washWip.a) - getVal(wipFormulas.washWip.b);
      const finishWip = getVal(wipFormulas.finishWip.a) - getVal(wipFormulas.finishWip.b);
      const polyWip = getVal(wipFormulas.polyWip.a) - getVal(wipFormulas.polyWip.b);

      // WIP Status Logic
      let currentStatus = 'Ready';
      if (row.poly >= row.orderQty && row.orderQty > 0) currentStatus = 'Completed';
      else if (polyWip > 0) currentStatus = 'Packing';
      else if (finishWip > 0) currentStatus = 'Finishing';
      else if (washWip > 0) currentStatus = 'Wash';
      else if (sewingWip > 0) currentStatus = 'Sewing';
      else if (row.cutting > 0) currentStatus = 'Cutting';
      
      return {
        ...row,
        cuttingPer: row.orderQty > 0 ? (row.cutting / row.orderQty) * 100 : 0,
        sewingWip,
        washWip,
        finishWip,
        polyWip,
        wipStatus: currentStatus,
        remarks: ''
      };
    });

    // Sort as requested: Buyer > Style > PO > Color
    return data.sort((a, b) => {
      const buyerCmp = (a.buyer || '').localeCompare(b.buyer || '');
      if (buyerCmp !== 0) return buyerCmp;
      const styleCmp = (a.style || '').localeCompare(b.style || '');
      if (styleCmp !== 0) return styleCmp;
      const poCmp = (a.poNo || '').localeCompare(b.poNo || '');
      if (poCmp !== 0) return poCmp;
      return (a.color || '').localeCompare(b.color || '');
    });
  }, [orders, entries, dateRange, deferredSearchStyle, deferredSearchBuyer, selectedCols, wipFormulas]);

  // Process data to inject subtotals
  const reportData = useMemo(() => {
    if (rawReportData.length === 0) return [];

    const result: any[] = [];
    
    // Check which levels are active
    const hasColor = selectedCols.includes('color');
    const hasPO = selectedCols.includes('poNo');
    const hasStyle = selectedCols.includes('style');
    const hasBuyer = selectedCols.includes('buyer');

    // Group totals accumulators
    let colorTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
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

    const createSubtotalRow = (type: 'po' | 'color' | 'style' | 'buyer' | 'grand', label: string, totals: any) => {
      const wips = calculateWips(totals);
      return {
        buyer: type === 'grand' ? 'GRAND' : (type === 'buyer' ? 'BUYER TOTAL' : ''),
        style: type === 'style' ? 'STYLE TOTAL' : '',
        poNo: type === 'po' ? 'PO TOTAL' : '',
        color: type === 'color' ? 'COLOR TOTAL' : label,
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
      [colorTotal, poTotal, styleTotal, buyerTotal, grandTotalAccum].forEach(t => {
        t.orderQty += current.orderQty;
        t.cutting += current.cutting;
        t.sewing += current.sewing;
        t.wash += current.wash;
        t.finInput += current.finInput;
        t.finishing += current.finishing;
        t.poly += current.poly;
      });

      // Check for breaks based on ACTIVE columns AND user config
      const colorChange = hasColor && subtotalConfig.color && (!next || current.color !== next.color);
      const poChange = hasPO && subtotalConfig.po && (!next || current.poNo !== next.poNo);
      const styleChange = hasStyle && subtotalConfig.style && (!next || current.style !== next.style);
      const buyerChange = hasBuyer && subtotalConfig.buyer && (!next || current.buyer !== next.buyer);

      if (colorChange) {
        result.push(createSubtotalRow('color', `COLOR: ${current.color} TOTAL`, colorTotal));
        colorTotal = { orderQty: 0, cutting: 0, sewing: 0, wash: 0, finInput: 0, finishing: 0, poly: 0 };
      }

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
    if (subtotalConfig.grand) {
      result.push(createSubtotalRow('grand', 'GRAND TOTAL', grandTotalAccum));
    }

    return result;
  }, [rawReportData, selectedCols, wipFormulas, subtotalConfig]);

  const displayedReportData = useMemo(() => {
    return reportData.slice(0, displayLimit);
  }, [reportData, displayLimit]);

  // Re-derived selected columns in stored order
  const activeCols = useMemo(() => {
    // Re-ordering based on the order in which user selected the columns
    return selectedCols;
  }, [selectedCols]);

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

  const [isExporting, setIsExporting] = useState(false);

  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const jspdfMod = await import('jspdf');
      const jsPDFConstructor = (jspdfMod.jsPDF || (jspdfMod as any).default || jspdfMod) as any;
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDFConstructor('l', 'mm', 'a4');
      
      const reportDateStr = format(new Date(), 'dd-MMM-yy');
      const reportTimeStr = format(new Date(), 'hh:mm:ss a');
      const userEmail = auth.currentUser?.email?.toUpperCase() || 'SYSTEM';

      // 1. Branding Header (Professional White Theme)
      // Clean white background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 297, 40, 'F');
      
      // Accent Stripe (Theme Yellow)
      doc.setFillColor(245, 158, 11);
      doc.rect(10, 35, 277, 1.5, 'F');
      
      // Branding text
      doc.setTextColor(15, 23, 42); // slate-900 (Black)
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text("ALPHA CLOTHING LTD.", 15, 20);
      
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("The Best Look Anytime Anywhere", 15, 26);
      doc.text("Tenguri, BKSP, Ashulia, Savar, Dhaka", 15, 31);

      // Report Info (Right Aligned)
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const rTitle = "CUSTOM PRODUCTION REPORT";
      const rTitleWidth = doc.getTextWidth(rTitle);
      doc.text(rTitle, 282, 20, { align: 'right' });
      
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(282 - rTitleWidth, 22, 282, 22);
      
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`PREPARED BY: ${userEmail}`, 282, 26, { align: 'right' });
      
      doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "normal");
      doc.text(`DATE: ${reportDateStr} | TIME: ${reportTimeStr}`, 282, 30, { align: 'right' });
      doc.text(`PERIOD: ${dateRange.start} TO ${dateRange.end}`, 282, 34, { align: 'right' });

      // 2. Prepare Data for AutoTable
      const tableHeaders = activeCols.map(col => MASTER_COLUMNS[col].toUpperCase());
      const tableRows = reportData.map(d => {
        return activeCols.map(col => {
          const val = (d as any)[col];
          if (col.includes('Per')) return typeof val === 'number' ? val.toFixed(1) + '%' : val;
          if (typeof val === 'number') return val.toLocaleString();
          return val;
        });
      });

      // 3. Generate Table
      autoTable(doc, {
        head: [tableHeaders],
        body: tableRows,
        startY: 50,
        theme: 'grid',
        styles: {
          fontSize: 8.5,
          cellPadding: 3,
          valign: 'middle',
          halign: 'center',
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [245, 158, 11],
          fontSize: 9.5,
          fontStyle: 'bold',
          lineWidth: 0.1,
          minCellHeight: 10
        },
        bodyStyles: {
          textColor: [30, 41, 59],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        didParseCell: (data) => {
          // Highlight Subtotals
          const rowData = reportData[data.row.index];
          if (rowData?.isSubtotal) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [226, 232, 240];
            if (rowData.subtotalType === 'grand') {
              data.cell.styles.fillColor = [251, 191, 36];
              data.cell.styles.textColor = [0, 0, 0];
            }
          }
          // WIP Colors
          const colKey = activeCols[data.column.index];
          if (colKey?.includes('Wip') && !rowData?.isSubtotal) {
            const val = data.cell.raw as number;
            if (val > 0) data.cell.styles.textColor = [217, 119, 6];
            if (val < 0) data.cell.styles.textColor = [220, 38, 38];
          }
        }
      });

      doc.save(`Report_${format(new Date(), 'ddMMMyy_HHmm')}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = () => {
    setIsExporting(true);
    try {
      // 1. Create headers with metadata
      const header = [
        ["ALPHA CLOTHING LTD."],
        ["CUSTOM PRODUCTION REPORT"],
        [`Address: Tenguri, BKSP, Ashulia, Savar, Dhaka`],
        [`Period: ${dateRange.start} TO ${dateRange.end}`],
        [`Generated At: ${format(new Date(), 'dd-MMM-yy HH:mm:ss')}`],
        []
      ];

      // 2. Prepare column headers
      const colHeaders = activeCols.map(col => MASTER_COLUMNS[col].toUpperCase());

      // 3. Prepare data rows
      const dataRows = reportData.map(d => {
        return activeCols.map(col => {
          const val = (d as any)[col];
          if (col.includes('Per')) return typeof val === 'number' ? (val / 100) : val;
          return val;
        });
      });

      // 4. Combine all into one sheet
      const finalData = [...header, colHeaders, ...dataRows];
      
      const worksheet = XLSX.utils.aoa_to_sheet(finalData);
      
      // Formatting
      const colSpan = activeCols.length > 0 ? activeCols.length - 1 : 5;
      worksheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colSpan } }, 
        { s: { r: 1, c: 0 }, e: { r: 1, c: colSpan } }, 
        { s: { r: 2, c: 0 }, e: { r: 2, c: colSpan } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: colSpan } },
        { s: { r: 4, c: 0 }, e: { r: 4, c: colSpan } },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Production Report");
      XLSX.writeFile(workbook, `Report_${format(new Date(), 'ddMMMyy_HHmm')}.xlsx`);
    } catch (err) {
      console.error('Excel Export Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  useImperativeHandle(ref, () => ({
    exportToPDF,
    exportToExcel
  }));

  return (
    <div className="flex flex-col gap-8 h-full min-h-[850px]">
      {/* Top Filter Section - Compact 4-in-1 Line */}
      <section className="bg-bg2/60 border border-border rounded-[32px] p-6 backdrop-blur-3xl shadow-2xl no-print">
         <div className="flex items-center gap-3 mb-6">
            <ListFilter size={20} className="text-indigo-400" />
            <h3 className="font-black uppercase tracking-widest text-[11px] text-fg">Report Filters</h3>
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
           {/* Subtotal Config Section */}
           <section className="bg-bg2/60 border border-border rounded-[32px] p-6 backdrop-blur-3xl shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <Settings2 size={20} className="text-accent" />
              <h3 className="font-black uppercase tracking-widest text-[11px] text-fg">Subtotal Settings</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(subtotalConfig) as Array<keyof typeof subtotalConfig>).map((key) => (
                <button
                  key={key}
                  onClick={() => setSubtotalConfig(prev => ({ ...prev, [key]: !prev[key] }))}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-95",
                    subtotalConfig[key] 
                      ? "bg-accent/10 border-accent text-accent" 
                      : "bg-bg/40 border-border text-muted hover:border-muted"
                  )}
                >
                  <div className={cn(
                    "w-3 h-3 rounded-full border",
                    subtotalConfig[key] ? "bg-accent border-accent" : "border-muted"
                  )} />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none">{key} Total</span>
                </button>
              ))}
            </div>
          </section>

           <section className="bg-bg2/60 border border-border rounded-[32px] p-6 backdrop-blur-3xl shadow-2xl h-[470px] flex flex-col">
           <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-3">
                 <Settings2 size={20} className="text-indigo-400" />
                 <h3 className="font-black uppercase tracking-widest text-[11px] text-fg">Visible Columns</h3>
              </div>
           </div>

           <div className="flex gap-2 mb-4 shrink-0 px-1">
             <button onClick={() => setSelectedCols(Object.keys(MASTER_COLUMNS))} className="flex-1 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black uppercase text-indigo-400">All</button>
             <button onClick={() => {
               setSelectedCols(['style', 'color', 'orderQty']);
               setColumnOrder(Object.keys(MASTER_COLUMNS));
             }} className="flex-1 py-1.5 rounded-lg bg-bg/50 border border-border text-[8px] font-black uppercase text-muted">Reset</button>
           </div>
           
           <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-1 px-1">
              {columnOrder.map((key) => {
                const label = MASTER_COLUMNS[key];
                const isActive = selectedCols.includes(key);
                const isWipField = key.toLowerCase().includes('wip') && key !== 'wipStatus';

                return (
                  <div key={key}>
                    <div 
                      className={cn(
                        "w-full group px-3 py-2.5 rounded-xl border transition-all flex items-center gap-3",
                        isActive ? "bg-indigo-500/15 border-indigo-500/40 text-fg" : "bg-bg/40 border-border/40 text-muted opacity-60 hover:opacity-100"
                      )}
                    >
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
                    </div>

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
           </div>
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
                   disabled={isExporting}
                   className={cn(
                     "flex items-center gap-3 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                     isExporting ? "bg-bg/40 border border-border text-muted" : "bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                   )}
                 >
                   {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                   {isExporting ? "Generating..." : "Export Excel"}
                 </button>
                 <button 
                   onClick={exportToPDF}
                   disabled={isExporting}
                   className={cn(
                     "flex items-center gap-3 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                     isExporting ? "bg-bg/40 border border-border text-muted" : "bg-accent text-slate-950 hover:brightness-110"
                   )}
                 >
                   {isExporting ? <RefreshCw size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                   {isExporting ? "Preparing PDF..." : "Download PDF"}
                 </button>
              </div>
           </header>

           <div id="report-table-container" className="flex-1 overflow-auto bg-gradient-to-b from-transparent to-bg/20">
              <table className="w-full text-left border-collapse table-auto et">
                 <thead className="sticky top-0 z-30">
                    <tr className="bg-bg2/95 backdrop-blur-xl">
                       {activeCols.map(col => (
                         <th key={col} className="px-5 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] border-b border-border border-r border-border/10 last:border-r-0 whitespace-nowrap text-center bg-bg/80 relative group/th">
                            <div className="flex items-center justify-center gap-2">
                               {MASTER_COLUMNS[col]}
                               {col.includes('Wip') && !!wipFormulas[col] && (
                                 <div className="relative">
                                    <Info size={12} className="text-accent/60" />
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-bg border border-border rounded-lg shadow-2xl opacity-0 group-hover/th:opacity-100 transition-all pointer-events-none z-50 whitespace-nowrap">
                                       <div className="text-[9px] font-black text-accent uppercase tracking-widest leading-none mb-1 text-center">Calculation Logic</div>
                                       <div className="text-[10px] text-white font-bold normal-case leading-none text-center">{MASTER_COLUMNS[wipFormulas[col].a]} - {MASTER_COLUMNS[wipFormulas[col].b]}</div>
                                       <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-border" />
                                    </div>
                                 </div>
                               )}
                            </div>
                         </th>
                       ))}
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-border/20">
                    {displayedReportData.map((d, i) => (
                       <tr 
                         key={d.isSubtotal ? `sub_${d.subtotalType}_${i}` : `${d.poNo}_${d.color}_${i}_idx`} 
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
                       </tr>
                    ))}
                    {reportData.length > displayLimit && (
                      <tr>
                        <td colSpan={activeCols.length} className="p-8 text-center bg-bg/20">
                          <button 
                            onClick={() => setDisplayLimit(prev => prev + 500)}
                            className="px-10 py-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all shadow-xl active:scale-95"
                          >
                            Synchronize Next Batch ({reportData.length - displayLimit} Nodes Remaining)
                          </button>
                        </td>
                      </tr>
                    )}
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
                 ALPHA CLOTHING LTD. PRODUCTION INTELLIGENCE v5.5.42
              </div>
           </footer>
        </div>
      </main>
    </div>
    </div>
  );
});

export default ReportBuilder;
