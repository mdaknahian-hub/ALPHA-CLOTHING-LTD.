import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Scissors, 
  RotateCcw, 
  FileUp, 
  FileDown,
  Database, 
  Keyboard, 
  FileText, 
  BarChart3, 
  LayoutDashboard,
  Clock,
  Activity,
  Plus,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Filter,
  X,
  Printer,
  Info,
  CheckCircle2,
  AlertCircle,
  InfoIcon,
  AlertTriangle,
  Shirt,
  Box as BoxIcon,
  Target,
  Shield,
  ClipboardList,
  Save,
  Eraser,
  Tag,
  Sun,
  Moon,
  Download,
  Sparkles,
  FileSpreadsheet,
  Settings2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { cn } from './lib/utils';
import { Order, ProductionEntry, POInfo } from './types';
import { DEFAULT_ORDERS, DEFAULT_ENTRIES, BUYERS } from './constants';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDoc } from 'firebase/firestore';

// --- Components (Lazy Loaded) ---
const OrderMaster = React.lazy(() => import('./components/OrderMaster'));
const DataEntry = React.lazy(() => import('./components/DataEntry'));
const DPRReport = React.lazy(() => import('./components/DPRReport'));
const WIPReport = React.lazy(() => import('./components/WIPReport'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const StatusReport = React.lazy(() => import('./components/OrderStatus'));
const SettingsModule = React.lazy(() => import('./components/SettingsModule'));
const SystemHealth = React.lazy(() => import('./components/SystemHealth'));
const FinishingTracker = React.lazy(() => import('./components/FinishingTracker'));
const ReportBuilder = React.lazy(() => import('./components/ReportBuilder'));
const AboutSection = React.lazy(() => import('./components/AboutSection'));
import Login from './components/Login';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; permissions?: string[]; status?: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [activeTab, setActiveTab] = useState('dash');
  const [appSettings, setAppSettings] = useState({
    primaryColor: '#f59e0b',
    fontSize: 'md',
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    navPosition: 'top',
    compactMode: false
  });
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'er' | 'in' }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  // --- Memoized PO Lookup Map ---
  const poLookupMap = useMemo(() => {
    const map = new Map<string, POInfo>();
    const poGroups: Record<string, Order[]> = {};
    
    orders.forEach(o => {
      if (!poGroups[o.poNo]) poGroups[o.poNo] = [];
      poGroups[o.poNo].push(o);
    });
    
    Object.entries(poGroups).forEach(([poNo, rows]) => {
      map.set(poNo, {
        buyer: rows[0].buyer,
        style: rows[0].style,
        poNo: poNo,
        shipDate: rows[0].shipDate,
        colors: rows.map(r => r.color),
        totalQty: rows.reduce((s, r) => s + r.orderQty, 0),
        colorRows: rows
      });
    });
    
    return map;
  }, [orders]);

  const getPOInfo = (poNo: string): POInfo | null => {
    return poLookupMap.get(poNo) || null;
  };

  // --- Memoized Aggregates for Performance ---
  const aggregates = useMemo(() => {
    const poMap: Record<string, any> = {};
    const poColorMap: Record<string, any> = {};

    entries.forEach(e => {
      const pKey = e.poNo;
      const pcKey = `${e.poNo}-${e.color}`;

      [pKey, pcKey].forEach((key, idx) => {
        const targetMap = idx === 0 ? poMap : poColorMap;
        if (!targetMap[key]) {
          targetMap[key] = { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0, shipment: 0 };
        }
        const m = targetMap[key];
        m.cut += (e.cut || 0);
        m.sewOut += (e.sewOut || 0);
        m.washR += (e.washR || 0);
        m.finIn += (e.finIn || 0);
        m.finOut += (e.finOut || 0);
        m.poly += (e.poly || 0);
        m.shipment += (e.shipment || 0);
      });
    });

    return { poMap, poColorMap };
  }, [entries]);

  const toastCounter = useRef(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // --- Auth State ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as { role: string; permissions?: string[]; status?: string };
          if (data.status === 'suspended') {
            await signOut(auth);
            addToast('Your account has been suspended. Please contact admin.', 'er');
            setUserProfile(null);
            setUser(null);
          } else {
            setUserProfile(data);
          }
        }
      } else {
        setUserProfile(null);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Initialization ---
  useEffect(() => {
    const savedSettings = localStorage.getItem('acl_settings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setAppSettings(parsed);
      // Apply saved settings
      document.documentElement.style.setProperty('--color-accent', parsed.primaryColor);
      document.documentElement.style.setProperty('--font-sans', parsed.fontFamily);
      document.documentElement.style.fontSize = parsed.fontSize === 'sm' ? '14px' : parsed.fontSize === 'lg' ? '18px' : '16px';
    }
  }, []);

  const updateAppSettings = (newSettings: any) => {
    setAppSettings(newSettings);
    localStorage.setItem('acl_settings', JSON.stringify(newSettings));
  };

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setEntries([]);
      return;
    }

    const qOrders = query(collection(db, 'orders'));
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setOrders(ordersData);
      setIsLoaded(true);
    });

    const qEntries = query(collection(db, 'entries'), orderBy('date', 'desc'));
    const unsubEntries = onSnapshot(qEntries, (snapshot) => {
      const entriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      setEntries(entriesData);
    });

    return () => {
      unsubOrders();
      unsubEntries();
    };
  }, [user]);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('acl_theme', theme);
    }
  }, [isLoaded, theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    addToast(`Switched to ${newTheme} mode`, 'in');
  };

  // --- Helpers ---
  const addToast = (msg: string, type: 'ok' | 'er' | 'in' = 'ok') => {
    const id = Date.now() + toastCounter.current;
    toastCounter.current += 1;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const resetAll = () => {
    if (window.confirm('Reset all data to sample data?')) {
      setOrders(DEFAULT_ORDERS);
      setEntries(DEFAULT_ENTRIES);
      addToast('Data reset to sample', 'in');
    }
  };

  const downloadPDF = async () => {
    if (!contentRef.current) return;
    
    addToast('Generating Professional PDF...', 'in');
    
    try {
      const html2canvasMod = await import('html2canvas');
      const html2canvas = (html2canvasMod.default || html2canvasMod) as any;
      const jspdfMod = await import('jspdf');
      const jsPDFConstructor = (jspdfMod.jsPDF || (jspdfMod as any).default || jspdfMod) as any;
      
      const element = contentRef.current;
      const reportDate = format(new Date(), 'dd-MMM-yy');
      const reportTime = format(new Date(), 'hh:mm:ss a');
      
      // Determine orientation based on report type
      const isWideReport = activeTab === 'wip' || activeTab === 'dpr' || activeTab === 'status';
      const orientation = isWideReport ? 'l' : 'p';
      const captureWidth = isWideReport ? 1600 : 1100;

      // Create a temporary container for the clone
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = `${captureWidth}px`; 
      container.style.backgroundColor = '#ffffff';
      document.body.appendChild(container);
      
      const reportWrapper = document.createElement('div');
      reportWrapper.style.padding = '30px';
      reportWrapper.style.backgroundColor = '#ffffff';
      container.appendChild(reportWrapper);

      // Professional Header
      const header = document.createElement('div');
      header.style.background = '#f8fafc';
      header.style.borderBottom = '3px solid #f59e0b';
      header.style.marginBottom = '25px';
      header.style.padding = '25px';
      header.style.borderRadius = '12px';
      header.style.textAlign = 'center';
      header.style.fontFamily = 'Arial, sans-serif';
      header.style.position = 'relative';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';
      header.innerHTML = `
        <div style="display: flex; align-items: center; gap: 20px;">
          <img src="/logo-2.png" 
               style="width: 80px; height: 80px; object-fit: contain; border-radius: 12px; background: #020617; padding: 5px; border: 2px solid #f59e0b;" 
               referrerPolicy="no-referrer"
               onError="this.src='/logo.png'" />
          <div style="text-align: left;">
            <h1 style="font-size: 28px; font-weight: 900; margin: 0; color: #0f172a; letter-spacing: -0.5px;">ALPHA CLOTHING LTD.</h1>
            <p style="font-size: 11px; font-weight: 800; margin: 2px 0; color: #f59e0b; text-transform: uppercase; letter-spacing: 2px;">The Best Look Anytime Anywhere</p>
            <p style="font-size: 10px; font-weight: bold; margin: 0; color: #64748b;">Tenguri, BKSP, Ashulia, Savar, Dhaka</p>
          </div>
        </div>
        <div style="text-align: right;">
          <h2 style="font-size: 18px; font-weight: 900; margin: 0; color: #020617; text-transform: uppercase; letter-spacing: 1px;">${activeTab.replace('-', ' ').toUpperCase()} REPORT</h2>
          <div style="margin-top: 8px; font-size: 9px; color: #64748b; font-weight: bold;">
            <div style="color: #020617;">PREPARED BY: ${user?.email?.toUpperCase() || 'SYSTEM'}</div>
            <div>DATE: ${reportDate} | TIME: ${reportTime}</div>
          </div>
        </div>
      `;
      reportWrapper.appendChild(header);

      const clone = element.cloneNode(true) as HTMLElement;
      reportWrapper.appendChild(clone);
      
      // Clean up clone for printing
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        el.style.backgroundColor = 'transparent';
        el.style.color = '#020617';
        el.style.borderColor = '#e2e8f0';
        el.style.boxShadow = 'none';
        
        if (el.tagName === 'BUTTON' || el.classList.contains('no-print') || el.classList.contains('btn') || el.tagName === 'NAV') {
          el.style.display = 'none';
        }
        
        if (el.tagName === 'TABLE') {
          el.style.width = '100%';
          el.style.borderCollapse = 'separate';
          el.style.borderSpacing = '0';
          el.style.marginTop = '10px';
          el.style.borderRadius = '8px';
          el.style.overflow = 'hidden';
          el.style.border = '1px solid #e2e8f0';
        }
        
        if (el.tagName === 'TH') {
          el.style.backgroundColor = '#f1f5f9';
          el.style.color = '#020617';
          el.style.borderBottom = '2px solid #f59e0b';
          el.style.padding = '12px 8px';
          el.style.fontSize = '10px';
          el.style.fontWeight = '900';
          el.style.textTransform = 'uppercase';
        }
        
        if (el.tagName === 'TD') {
          el.style.borderBottom = '1px solid #f1f5f9';
          el.style.padding = '10px 8px';
          el.style.fontSize = '10px';
          el.style.fontWeight = '500';
        }

        if (el.classList.contains('overflow-x-auto') || el.classList.contains('max-h-[60vh]')) {
          el.style.maxHeight = 'none';
          el.style.overflow = 'visible';
        }
      });

      // Capture Header
      const headerCanvas = await html2canvas(header, { 
        scale: 2, 
        backgroundColor: '#fff',
        onclone: (clonedDoc) => {
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
      const headerImg = headerCanvas.toDataURL('image/jpeg', 1.0);

      // Capture Content
      const contentCanvas = await html2canvas(clone, { 
        scale: 2, 
        backgroundColor: '#fff', 
        useCORS: true,
        onclone: (clonedDoc) => {
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
      const contentImg = contentCanvas.toDataURL('image/jpeg', 1.0);
      
      document.body.removeChild(container);

      const pdf = new (jsPDFConstructor as any)(orientation, 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const headerH = (headerCanvas.height * pdfWidth) / headerCanvas.width;
      const contentW = pdfWidth;
      const contentH = (contentCanvas.height * pdfWidth) / contentCanvas.width;
      
      const margin = 10;
      const footerH = 10;
      const pageContentH = pdfHeight - headerH - footerH - (margin * 2);
      
      let heightLeft = contentH;
      let position = 0;
      let page = 1;

      while (heightLeft > 0) {
        if (page > 1) pdf.addPage();
        
        // 1. Draw Content Slice (using negative Y to shift the image up)
        const position = -((page - 1) * pageContentH);
        pdf.addImage(contentImg, 'JPEG', 0, headerH + margin + position, contentW, contentH, undefined, 'FAST');
        
        // 2. Clear Header Area (draw white rectangle over the top part of the slice)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, pdfWidth, headerH + margin, 'F');
        
        // 3. Draw Header on every page
        pdf.addImage(headerImg, 'JPEG', 0, 0, pdfWidth, headerH);
        
        // 4. Clear Footer Area (draw white rectangle over the bottom part of the slice)
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, pdfHeight - footerH, pdfWidth, footerH, 'F');
        
        // 5. Add Page Number and Footer Text
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(`Alpha Clothing Ltd. Production System | Page ${page}`, margin, pdfHeight - 5);
        
        heightLeft -= pageContentH;
        page++;
      }

      pdf.save(`ACL_${activeTab.toUpperCase()}_${format(new Date(), 'ddMMMyy_HHmm')}.pdf`);
      addToast('Professional PDF Generated', 'ok');
    } catch (error) {
      console.error('PDF Error:', error);
      addToast('PDF Generation Failed', 'er');
    }
  };

  const exportExcel = async () => {
    try {
      addToast('Initializing Excel Engine...', 'in');
      const XLSX = await import('xlsx');
      
      addToast('Preparing Excel Report...', 'in');
      
      let rows: any[][] = [];
      let sheetName = "Report";
      const timestamp = format(new Date(), 'ddMMMyyyy_HHmm');
      let filename = `ACL_Report_${activeTab.toUpperCase()}_${timestamp}.xlsx`;

      // Professional Header
      rows.push(["ALPHA CLOTHING LTD."]);
      rows.push(["TENGURI, BKSP, ASHULIA, SAVAR, DHAKA"]);
      rows.push([`${activeTab.toUpperCase()} REPORT`]);
      rows.push([`Generated by: ${user?.email || 'System'}`]);
      rows.push([`Date: ${format(new Date(), 'dd-MMM-yy HH:mm:ss')}`]);
      rows.push([]); // Spacer

      if (activeTab === 'master') {
        sheetName = "Order Master";
        rows.push(['SL', 'Buyer', 'Style', 'PO No', 'Ship Date', 'Color', 'Order Qty']);
        orders.forEach((o, i) => {
          rows.push([i + 1, o.buyer, o.style, o.poNo, o.shipDate, o.color, o.orderQty]);
        });
      } else if (activeTab === 'entry') {
        sheetName = "Production Entries";
        rows.push(['Date', 'PO No', 'Color', 'Line/Floor', 'Cut', 'Sew Out', 'Wash R', 'Fin In', 'Fin Out', 'Poly', 'Shipment']);
        entries.forEach(e => {
          rows.push([e.date, e.poNo, e.color, e.lineNo || e.floor || 'N/A', e.cut, e.sewOut, e.washR, e.finIn, e.finOut, e.poly, e.shipment]);
        });
      } else if (activeTab === 'dashboard') {
        sheetName = "Dashboard Summary";
        const totalCut = entries.reduce((s, e) => s + (e.cut || 0), 0);
        const totalSew = entries.reduce((s, e) => s + (e.sewOut || 0), 0);
        const totalPoly = entries.reduce((s, e) => s + (e.poly || 0), 0);
        const totalShip = entries.reduce((s, e) => s + (e.shipment || 0), 0);
        const totalOrder = orders.reduce((s, o) => s + (o.orderQty || 0), 0);
        
        rows.push(['Metric', 'Value']);
        rows.push(['Total Cutting', totalCut]);
        rows.push(['Total Sewing Out', totalSew]);
        rows.push(['Total Poly Entry', totalPoly]);
        rows.push(['Total Shipment', totalShip]);
        rows.push(['Total Order Quantity', totalOrder]);
        rows.push(['Overall Achievement', totalOrder ? Math.round((totalPoly / totalOrder) * 100) + '%' : '0%']);
      } else if (activeTab === 'wip') {
        sheetName = "WIP Report";
        rows.push([
          'SL', 'Buyer', 'Style', 'PO No', 'Ship Date', 'Order Qty', 
          'Cut Qty', 'Cut %', 'Sewing', 'Sew WIP', 'Wash Recv', 'Wash WIP',
          'Fin In', 'Input WIP', 'Fin Out', 'Output WIP', 'Poly Qty', 'Poly WIP',
          'Shipment', 'Stock'
        ]);
        
        const uniquePOs: string[] = Array.from(new Set(entries.map(e => e.poNo)));
        uniquePOs.forEach((po, i) => {
          const info = getPOInfo(po);
          if (!info) return;
          const poEntries = entries.filter(e => e.poNo === po);
          const totalOrderQty = info.totalQty;
          const cumCut = poEntries.reduce((s, e) => s + (e.cut || 0), 0);
          const cumSewOut = poEntries.reduce((s, e) => s + (e.sewOut || 0), 0);
          const cumWashR = poEntries.reduce((s, e) => s + (e.washR || 0), 0);
          const cumFinIn = poEntries.reduce((s, e) => s + (e.finIn || 0), 0);
          const cumFinOut = poEntries.reduce((s, e) => s + (e.finOut || 0), 0);
          const cumPoly = poEntries.reduce((s, e) => s + (e.poly || 0), 0);
          const cumShipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0);
          const cuttingAch = totalOrderQty ? Math.round((cumCut / totalOrderQty) * 100 * 10) / 10 : 0;

          rows.push([
            i + 1,
            info.buyer,
            info.style,
            info.poNo,
            info.shipDate,
            totalOrderQty,
            cumCut,
            cuttingAch + '%',
            cumSewOut,
            cumCut - cumSewOut,
            cumWashR,
            cumSewOut - cumWashR,
            cumFinIn,
            cumWashR - cumFinIn,
            cumFinOut,
            cumFinIn - cumFinOut,
            cumPoly,
            totalOrderQty - cumPoly,
            cumShipment,
            cumPoly - cumShipment
          ]);
        });
      } else if (activeTab === 'dpr') {
        sheetName = "DPR Report";
        rows.push([
          'Date', 'Buyer', 'Style', 'PO No', 'Color', 'Line/Floor',
          'Cutting', 'Sew Out', 'Wash Recv', 'Fin In', 'Fin Out', 'Poly', 'Shipment'
        ]);
        
        const sortedEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date));
        sortedEntries.forEach(e => {
          const info = getPOInfo(e.poNo);
          rows.push([
            e.date,
            info?.buyer || 'N/A',
            info?.style || 'N/A',
            e.poNo,
            e.color,
            e.lineNo || e.floor || 'N/A',
            e.cut || 0,
            e.sewOut || 0,
            e.washR || 0,
            e.finIn || 0,
            e.finOut || 0,
            e.poly || 0,
            e.shipment || 0
          ]);
        });
      } else if (activeTab === 'status') {
        sheetName = "Order Status";
        rows.push([
          'SL', 'Buyer', 'Style', 'PO No', 'Color', 'Order Qty',
          'Cutting', 'Sewing', 'Poly', 'Shipment', 'Stock', 'Poly %'
        ]);
        
        orders.forEach((o, i) => {
          const poEntries = entries.filter(e => e.poNo === o.poNo && e.color === o.color);
          const poly = poEntries.reduce((s, e) => s + (e.poly || 0), 0);
          const shipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0);
          const sewOut = poEntries.reduce((s, e) => s + (e.sewOut || 0), 0);
          const cut = poEntries.reduce((s, e) => s + (e.cut || 0), 0);
          const polyAch = o.orderQty ? Math.round((poly / o.orderQty) * 100 * 10) / 10 : 0;

          rows.push([
            i + 1,
            o.buyer,
            o.style,
            o.poNo,
            o.color,
            o.orderQty,
            cut,
            sewOut,
            poly,
            shipment,
            poly - shipment,
            polyAch + '%'
          ]);
        });
      } else {
        addToast('Excel export not available for this tab', 'in');
        return;
      }

      if (rows.length <= 6) { // Only header rows
        addToast('No data to export', 'er');
        return;
      }

      const worksheet = XLSX.utils.aoa_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Set column widths
      const colWidths = rows[6] ? rows[6].map((_: any, i: number) => {
        let max = 10;
        rows.forEach(row => {
          if (row[i]) {
            const len = row[i].toString().length;
            if (len > max) max = len;
          }
        });
        return { wch: max + 2 };
      }) : [];
      worksheet['!cols'] = colWidths;

      XLSX.writeFile(workbook, filename);
      addToast('Excel Report Downloaded', 'ok');
    } catch (error) {
      console.error('Excel Error:', error);
      addToast('Excel Export Failed', 'er');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      addToast('Logged out successfully', 'in');
    } catch (err) {
      addToast('Logout failed', 'er');
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={() => addToast('Welcome back!', 'ok')} />;
  }

  const hasPermission = (p: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const navPosition = appSettings.navPosition || 'top';

  const navTabs = [
    { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, perm: 'view-data' },
    { id: 'master', label: 'Order Master', icon: Database, perm: 'view-data' },
    { id: 'entry', label: 'Data Entry', icon: Keyboard, perm: 'view-data' },
    { id: 'fin-track', label: 'Finishing', icon: ArrowRightLeft, perm: 'view-data' },
    { id: 'custom-report', label: 'Analytics', icon: FileSpreadsheet, perm: 'view-data' },
    { id: 'status', label: 'Tracking', icon: Target, perm: 'view-data' },
    { id: 'dpr', label: 'DPR', icon: FileText, perm: 'view-data' },
    { id: 'wip', label: 'WIP Audit', icon: BarChart3, perm: 'view-data' },
    { id: 'settings', label: 'Settings', icon: Settings2 },
  ];

  return (
    <div className={cn(
      "min-h-screen bg-bg text-fg font-sans selection:bg-accent selection:text-slate-950 flex",
      navPosition === 'side' ? "flex-row" : "flex-col"
    )}>
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed top-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 50, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className={cn(
                  "p-4 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border border-white/10 text-xs font-black uppercase tracking-widest pointer-events-auto min-w-[300px]",
                  t.type === 'ok' ? "bg-success/20 text-success border-success/30" : 
                  t.type === 'er' ? "bg-danger/20 text-danger border-danger/30" : 
                  "bg-info/20 text-info border-info/30"
                )}
              >
                {t.type === 'ok' && <CheckCircle2 size={14} />}
                {t.type === 'er' && <AlertCircle size={14} />}
                {t.type === 'in' && <InfoIcon size={14} />}
                {t.msg}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Side Navigation Layout */}
      {navPosition === 'side' && (
        <aside className={cn(
          "w-72 bg-bg2/95 backdrop-blur-3xl border-r border-border h-screen sticky top-0 flex flex-col no-print z-50 overflow-y-auto no-scrollbar shadow-2xl transition-all duration-500 shrink-0",
          appSettings.compactMode ? "w-20" : "w-72"
        )}>
          {/* Side Logo */}
          <div className="p-6 flex items-center gap-4 border-b border-border/50">
             <div className="w-12 h-12 rounded-xl bg-slate-900 border border-accent/20 flex items-center justify-center shrink-0 shadow-lg">
                <img src="/logo-2.png" alt="logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
             </div>
             {!appSettings.compactMode && (
               <div>
                  <h1 className="text-lg font-black tracking-tighter leading-none">ALPHA ERP</h1>
                  <span className="text-[8px] font-black text-accent uppercase tracking-widest mt-1 block">Production Control</span>
               </div>
             )}
          </div>

          <div className="flex-1 px-3 space-y-1 mt-6">
            {navTabs.map(tab => {
               if (tab.perm && !hasPermission(tab.perm)) return null;
               const isActive = activeTab === tab.id;
               return (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
                   className={cn(
                     "w-full flex items-center gap-4 p-3.5 rounded-2xl transition-all group relative",
                     isActive 
                       ? "bg-accent text-slate-950 shadow-xl shadow-accent/20 font-black" 
                       : "text-muted hover:bg-white/5 hover:text-fg font-bold"
                   )}
                 >
                    <tab.icon size={20} className={cn(isActive ? "text-slate-950" : "text-muted group-hover:text-fg")} />
                    {!appSettings.compactMode && (
                      <span className="text-[11px] uppercase tracking-widest">{tab.label}</span>
                    )}
                    {isActive && (
                      <motion.div layoutId="activeNavSide" className="absolute left-0 w-1 h-6 bg-slate-950 rounded-full" />
                    )}
                 </button>
               );
            })}
          </div>

          {/* User Profile Summary Side */}
          {!appSettings.compactMode && user && (
            <div className="p-4 m-3 rounded-2xl bg-white/5 border border-border mt-auto">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-slate-950 font-black">
                     {user.email?.[0].toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                     <div className="text-[10px] font-black uppercase truncate">{user.email}</div>
                     <div className="text-[9px] text-accent font-bold uppercase tracking-widest">{userProfile?.role}</div>
                  </div>
               </div>
            </div>
          )}
        </aside>
      )}

      {/* Main Content Wrapper */}
      <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", navPosition === 'side' ? "min-h-screen" : "")}>
        {/* Sticky Header Wrapper (Top/Horizontal Only) */}
        {navPosition === 'top' && (
          <div className="sticky top-0 z-50 no-print shadow-2xl shadow-slate-950/20">
            {/* Header */}
            <header className="bg-bg2/90 backdrop-blur-xl border-b border-border px-5 py-2.5 relative z-20">
              <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 shrink-0">
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-lg group cursor-pointer border border-accent/20 bg-slate-900/80 backdrop-blur-xl">
                    <img 
                      src="/logo-2.png" 
                      alt="Alpha Clothing Logo" 
                      className="w-full h-full object-contain p-1"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "/logo.png";
                      }}
                    />
                  </div>
                  <div className="hidden lg:block">
                    <h1 className="text-xl font-black tracking-tighter leading-none text-fg font-display">
                      ALPHA CLOTHING LTD
                    </h1>
                    <p className="text-[9px] text-accent font-black uppercase tracking-[0.2em] mt-1">
                      The Best Look Anytime Anywhere
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden md:flex flex-col items-end border-r border-border pr-4 h-8 justify-center">
                    <div className="flex items-center gap-2 text-[10px] font-black text-fg">
                        <Clock size={12} className="text-accent animate-pulse" />
                        <span className="font-mono">{format(time, 'HH:mm:ss')}</span>
                        <span className="opacity-40">|</span>
                        <span>{format(time, 'dd MMM yy')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button 
                        className="btn btn-p btn-s gap-2 rounded-xl h-9 px-4 shadow-lg shadow-accent/10" 
                        onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                      >
                        <Download size={14} /> <span className="hidden sm:inline text-[10px] font-black tracking-widest uppercase">Export HUB</span>
                      </button>
                      <AnimatePresence>
                        {isDownloadOpen && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setIsDownloadOpen(false)} />
                            <motion.div 
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute right-0 mt-4 w-60 bg-bg2/98 backdrop-blur-2xl border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[110] overflow-hidden"
                            >
                              <button onClick={() => { downloadPDF(); setIsDownloadOpen(false); }} className="w-full text-left px-5 py-4 text-[12px] font-bold hover:bg-accent/10 flex items-center gap-4 border-b border-border transition-colors">
                                <FileText size={16} className="text-accent" /> Download as PDF
                              </button>
                              <button onClick={() => { exportExcel(); setIsDownloadOpen(false); }} className="w-full text-left px-5 py-4 text-[12px] font-bold hover:bg-success/10 flex items-center gap-4 transition-colors">
                                <Download size={16} className="text-success" /> Download as Excel
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                    
                    <button className="btn btn-o btn-s rounded-xl border-border hover:bg-accent/10 p-2 h-9 w-9" onClick={toggleTheme}>
                      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {/* Top Tabs */}
            <div className="bg-bg2/90 backdrop-blur-xl border-b border-border px-5 relative z-10">
              <div className="max-w-[1700px] mx-auto flex gap-2 overflow-x-auto no-scrollbar py-1">
                {navTabs.map((tab: any) => {
                  if (tab.perm && !hasPermission(tab.perm)) return null;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "relative px-3.5 py-2 text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-2 rounded-lg my-0.5",
                        isActive 
                          ? "text-accent bg-accent/10 shadow-inner" 
                          : "text-muted hover:text-fg hover:bg-white/5"
                      )}
                    >
                      <tab.icon size={16} className={cn(isActive ? "text-accent" : "text-muted")} />
                      {tab.label}
                      {isActive && (
                        <motion.div 
                          layoutId="activeTab"
                          className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full"
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Minimal Header for Side Navigation (Mobile/Tablet) */}
        {navPosition === 'side' && (
           <header className={cn("sticky top-0 z-[60] bg-bg2/90 backdrop-blur-xl border-b border-border p-3 flex items-center justify-between no-print", appSettings.compactMode ? "" : "lg:hidden")}>
              <div className="flex items-center gap-3">
                 <img src="/logo-2.png" alt="logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                 <h1 className="text-sm font-black tracking-tight">ALPHA CLOTHING</h1>
              </div>
              <div className="flex items-center gap-2">
                 <div className="flex gap-1 overflow-x-auto no-scrollbar max-w-[160px]">
                    {navTabs.slice(0, 4).map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} className={cn("p-2 rounded-lg", activeTab === t.id ? "bg-accent text-slate-950" : "text-muted")}>
                           <t.icon size={14} />
                        </button>
                    ))}
                 </div>
                 <button className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-slate-950 font-black text-[10px]">
                   {user.email?.[0].toUpperCase()}
                 </button>
              </div>
           </header>
        )}

        {/* Main Content Area */}
        <main id="report-content" className={cn("mx-auto p-4 lg:p-6 flex-1 w-full", navPosition === 'top' ? "max-w-[1700px]" : "max-w-[1900px]")} ref={contentRef}>
          <React.Suspense fallback={
            <div className="flex flex-col items-center justify-center p-32 gap-6">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-accent/10 rounded-full" />
                <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-accent rounded-full animate-spin" />
              </div>
              <p className="text-[10px] font-black text-fg/60 dark:text-muted uppercase tracking-[0.5em] animate-pulse">Initializing Component...</p>
            </div>
          }>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 15, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.995 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="w-full h-full"
              >
                {activeTab === 'dash' && <Dashboard orders={orders} entries={entries} getPOInfo={getPOInfo} poColorAggregates={aggregates.poColorMap} />}
                {activeTab === 'master' && <OrderMaster orders={orders} addToast={addToast} userProfile={userProfile} />}
                {activeTab === 'entry' && <DataEntry orders={orders} entries={entries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />}
                {activeTab === 'fin-track' && <FinishingTracker orders={orders} />}
                {activeTab === 'status' && <StatusReport orders={orders} entries={entries} getPOInfo={getPOInfo} poColorAggregates={aggregates.poColorMap} />}
                {activeTab === 'dpr' && <DPRReport orders={orders} entries={entries} getPOInfo={getPOInfo} />}
                {activeTab === 'wip' && <WIPReport orders={orders} entries={entries} getPOInfo={getPOInfo} poAggregates={aggregates.poMap} />}
                {activeTab === 'custom-report' && <ReportBuilder orders={orders} entries={entries} />}
                {activeTab === 'health' && <SystemHealth orders={orders} entries={entries} />}
                {activeTab === 'about' && <AboutSection />}
                {activeTab === 'settings' && (
                  <SettingsModule 
                    orders={orders} 
                    entries={entries} 
                    userProfile={userProfile}
                    currentTheme={theme}
                    setTheme={setTheme}
                    appSettings={appSettings}
                    updateAppSettings={updateAppSettings}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </React.Suspense>
        </main>

        {/* Footer */}
        <footer className="bg-bg2 border-t border-border px-5 py-2.5 no-print">
          <div className="max-w-[1700px] mx-auto flex items-center justify-between">
            <span className="text-[10px] text-muted flex items-center gap-1.5 uppercase tracking-widest font-black">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Real-time Syc Active
            </span>
            <span className="text-[10px] text-muted font-mono uppercase tracking-widest">ALPHA PRO-TECH SERIES v5.1</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
