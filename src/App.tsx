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
  Plus,
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
  Box,
  Target,
  Shield,
  ClipboardList,
  Save,
  Eraser,
  Tag,
  Sun,
  Moon,
  Download,
  Sparkles
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
const OrderStatus = React.lazy(() => import('./components/OrderStatus'));
const AdminPanel = React.lazy(() => import('./components/AdminPanel'));
const AIAssistant = React.lazy(() => import('./components/AIAssistant'));
import Login from './components/Login';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; permissions?: string[]; status?: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [activeTab, setActiveTab] = useState('master');
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'er' | 'in' }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);

  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  
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
    const savedTheme = localStorage.getItem('acl_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') document.documentElement.classList.add('light');
    }
  }, []);

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
    const savedTheme = localStorage.getItem('acl_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') document.documentElement.classList.add('light');
    }
  }, []);

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
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      
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
      header.style.borderBottom = '2px solid #000';
      header.style.marginBottom = '20px';
      header.style.paddingBottom = '15px';
      header.style.textAlign = 'center';
      header.style.fontFamily = 'Arial, sans-serif';
      header.innerHTML = `
        <h1 style="font-size: 26px; font-weight: 900; margin: 0; color: #000;">ALPHA CLOTHING LTD.</h1>
        <p style="font-size: 10px; font-weight: bold; margin: 2px 0; color: #000;">TENGURI, BKSP, ASHULIA, SAVAR, DHAKA</p>
        <h2 style="font-size: 16px; font-weight: bold; margin: 10px 0; color: #000; text-decoration: underline;">${activeTab.toUpperCase()} REPORT</h2>
        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 9px; font-weight: bold; border-top: 1px solid #eee; padding-top: 5px;">
          <span>PREPARED BY: ${user?.email?.toUpperCase() || 'SYSTEM'}</span>
          <span>DATE: ${reportDate} | TIME: ${reportTime}</span>
        </div>
      `;
      reportWrapper.appendChild(header);

      const clone = element.cloneNode(true) as HTMLElement;
      reportWrapper.appendChild(clone);
      
      // Clean up clone for printing
      const allElements = clone.querySelectorAll('*');
      allElements.forEach((el: any) => {
        el.style.backgroundColor = 'transparent';
        el.style.color = '#000';
        el.style.borderColor = '#000';
        el.style.boxShadow = 'none';
        if (el.tagName === 'BUTTON' || el.classList.contains('no-print') || el.classList.contains('btn')) {
          el.style.display = 'none';
        }
        if (el.tagName === 'TABLE') {
          el.style.width = '100%';
          el.style.borderCollapse = 'collapse';
        }
        if (el.tagName === 'TD' || el.tagName === 'TH') {
          el.style.border = '1px solid #000';
          el.style.padding = '4px';
        }
        if (el.classList.contains('overflow-x-auto') || el.classList.contains('max-h-[60vh]')) {
          el.style.maxHeight = 'none';
          el.style.overflow = 'visible';
        }
      });

      // Capture Header
      const headerCanvas = await html2canvas(header, { scale: 2, backgroundColor: '#fff' });
      const headerImg = headerCanvas.toDataURL('image/jpeg', 1.0);

      // Capture Content
      const contentCanvas = await html2canvas(clone, { scale: 2, backgroundColor: '#fff', useCORS: true });
      const contentImg = contentCanvas.toDataURL('image/jpeg', 1.0);
      
      document.body.removeChild(container);

      const pdf = new jsPDF(orientation, 'mm', 'a4');
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
      setIsAdminUnlocked(false);
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

  return (
    <div className="relative z-10 min-h-screen flex flex-col bg-bg text-fg">
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "px-4 py-2.5 rounded-md text-[12px] font-semibold flex items-center gap-2 shadow-xl border",
                t.type === 'ok' && "bg-[#065f46] text-[#6ee7b7] border-success",
                t.type === 'er' && "bg-[#7f1d1d] text-[#fca5a5] border-danger",
                t.type === 'in' && "bg-[#164e63] text-[#67e8f9] border-info"
              )}
            >
              {t.type === 'ok' && <CheckCircle2 size={14} />}
              {t.type === 'er' && <AlertCircle size={14} />}
              {t.type === 'in' && <InfoIcon size={14} />}
              {t.msg}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sticky Header Wrapper */}
      <div className="sticky top-0 z-50 no-print shadow-2xl shadow-slate-950/20">
        {/* Header */}
        <header className="bg-bg2/90 backdrop-blur-xl border-b border-border px-5 py-3 relative z-20">
          <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 shrink-0">
              <div className="bg-gradient-to-br from-accent to-accent2 w-11 h-11 rounded-xl flex items-center justify-center shadow-xl shadow-accent/20 transform hover:rotate-12 transition-transform duration-300">
                <Scissors className="text-slate-950" size={24} />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-black tracking-tight text-fg leading-none">ALPHA CLOTHING LTD</h1>
                <p className="text-[10px] text-accent font-bold uppercase tracking-[0.2em] mt-1 opacity-80">Daily Production Report (DPR) System</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden lg:flex flex-col items-end border-r border-border pr-4">
                <span className="text-[9px] font-black text-muted uppercase tracking-widest opacity-60">Logged in as</span>
                <span className="text-xs font-extrabold text-fg">{user.email}</span>
              </div>
              
              <div className="hidden md:flex items-center gap-2 text-[11px] font-bold text-fg bg-bg/50 px-4 py-2 rounded-xl border border-border">
                <Clock size={14} className="text-accent" />
                <span className="num tracking-tighter">{format(new Date(), 'dd-MMM-yy HH:mm:ss')}</span>
              </div>

              <div className="flex items-center gap-2">
                <button className="btn btn-o btn-s rounded-xl border-border hover:bg-accent/10 p-2.5" onClick={toggleTheme} title="Toggle Theme">
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button className="btn btn-o btn-s text-danger border-danger/20 hover:bg-danger/10 rounded-xl px-4" onClick={handleLogout}>
                  Logout
                </button>
                
                {/* Download Report Button - Back to Right */}
                <div className="relative">
                  <button 
                    className="btn btn-a btn-s gap-2 rounded-xl shadow-lg shadow-info/20 px-5 h-10" 
                    onClick={() => setIsDownloadOpen(!isDownloadOpen)}
                  >
                    <FileDown size={18} /> <span className="hidden md:inline">Download Report</span>
                  </button>
                  <AnimatePresence>
                    {isDownloadOpen && (
                      <>
                        <div 
                          className="fixed inset-0 z-[100]" 
                          onClick={() => setIsDownloadOpen(false)} 
                        />
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-4 w-60 bg-bg2/98 backdrop-blur-2xl border border-border rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[110] overflow-hidden ring-1 ring-white/10"
                        >
                          <button 
                            className="w-full text-left px-5 py-4 text-[12px] font-bold hover:bg-accent/10 flex items-center gap-4 border-b border-border transition-colors"
                            onClick={() => {
                              downloadPDF();
                              setIsDownloadOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                              <FileText size={16} className="text-accent" />
                            </div>
                            Download as PDF
                          </button>
                          <button 
                            className="w-full text-left px-5 py-4 text-[12px] font-bold hover:bg-success/10 flex items-center gap-4 transition-colors"
                            onClick={() => {
                              exportExcel();
                              setIsDownloadOpen(false);
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                              <Download size={16} className="text-success" />
                            </div>
                            Download as Excel
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-bg2/90 backdrop-blur-xl border-b border-border px-5 relative z-10">
          <div className="max-w-[1700px] mx-auto flex gap-2 overflow-x-auto no-scrollbar py-1">
            {[
              { id: 'master', label: 'Order Master', icon: Database, perm: 'view-data' },
              { id: 'entry', label: 'Data Entry', icon: Keyboard, perm: 'view-data' },
              { id: 'status', label: 'Order Status', icon: Target, perm: 'view-data' },
              { id: 'dpr', label: 'DPR Report', icon: FileText, perm: 'view-data' },
              { id: 'wip', label: 'WIP Report', icon: BarChart3, perm: 'view-data' },
              { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, perm: 'view-data' },
              { id: 'ai', label: 'AI Assistant', icon: Sparkles, perm: 'view-data' },
              userProfile?.role === 'admin' && { id: 'admin', label: 'Admin Panel', icon: Shield },
            ].filter(Boolean).map((tab: any) => {
              if (tab.perm && !hasPermission(tab.perm)) return null;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative px-6 py-3.5 text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2.5 rounded-xl my-1",
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

      {/* Main Content */}
      <main id="report-content" className="max-w-[1700px] mx-auto p-6 flex-1 w-full" ref={contentRef}>
        <React.Suspense fallback={
          <div className="flex flex-col items-center justify-center p-32 gap-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-accent/10 rounded-full" />
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-t-accent rounded-full animate-spin" />
            </div>
            <p className="text-xs font-black text-muted uppercase tracking-[0.3em] animate-pulse">Initializing {activeTab.toUpperCase()} Module</p>
          </div>
        }>
          <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.99 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full"
          >
            {activeTab === 'master' && (
              <OrderMaster 
                orders={orders} 
                addToast={addToast} 
                userProfile={userProfile}
              />
            )}
            {activeTab === 'entry' && (
              <DataEntry 
                orders={orders} 
                entries={entries} 
                getPOInfo={getPOInfo}
                addToast={addToast} 
                userProfile={userProfile}
              />
            )}
            {activeTab === 'status' && (
              <OrderStatus 
                orders={orders} 
                entries={entries}
                getPOInfo={getPOInfo}
              />
            )}
            {activeTab === 'dpr' && (
              <DPRReport 
                orders={orders} 
                entries={entries} 
                getPOInfo={getPOInfo}
              />
            )}
            {activeTab === 'wip' && (
              <WIPReport 
                orders={orders} 
                entries={entries} 
                getPOInfo={getPOInfo}
              />
            )}
            {activeTab === 'dash' && (
              <Dashboard 
                orders={orders} 
                entries={entries} 
                getPOInfo={getPOInfo}
              />
            )}
            {activeTab === 'ai' && (
              <AIAssistant 
                orders={orders} 
                entries={entries} 
              />
            )}
            {activeTab === 'admin' && userProfile?.role === 'admin' && (
              isAdminUnlocked ? (
                <AdminPanel orders={orders} entries={entries} />
              ) : (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="bg-bg2 border border-border p-8 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto text-accent">
                      <Shield size={32} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Admin Verification</h3>
                      <p className="text-sm text-muted mt-1">Please enter the administrative password to continue</p>
                    </div>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        const pwd = (e.currentTarget.elements.namedItem('adminPwd') as HTMLInputElement).value;
                        if (pwd === 'admin123') { // Default password
                          setIsAdminUnlocked(true);
                          addToast('Admin access granted', 'ok');
                        } else {
                          addToast('Invalid admin password', 'er');
                        }
                      }}
                      className="space-y-4"
                    >
                      <input 
                        type="password" 
                        name="adminPwd"
                        placeholder="Enter Admin Password"
                        className="fi text-center py-3"
                        autoFocus
                      />
                      <button type="submit" className="btn btn-a w-full py-3">
                        Unlock Admin Panel
                      </button>
                    </form>
                  </div>
                </div>
              )
            )}
          </motion.div>
        </AnimatePresence>
      </React.Suspense>
    </main>

      {/* Footer */}
      <footer className="bg-bg2 border-t border-border px-5 py-2.5 no-print">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between">
          <span className="text-[10px] text-muted flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Synced with Firebase
          </span>
          <span className="text-[10px] text-muted font-mono">ALPHA CLOTHING LTD v5.0</span>
        </div>
      </footer>
    </div>
  );
}
