import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Database, 
  Keyboard, 
  LayoutDashboard,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  InfoIcon,
  Library,
  Target,
  ShieldCheck,
  Sun,
  Moon,
  Download,
  ChevronRight,
  Settings2,
  RefreshCw,
  Bot,
  FileText,
  FileSpreadsheet,
  Clock,
  User,
  Mail,
  Phone,
  Briefcase,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO } from 'date-fns';
import { cn } from './lib/utils';
import { Order, ProductionEntry, POInfo } from './types';
import { DEFAULT_ORDERS, DEFAULT_ENTRIES, BUYERS } from './constants';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';

// --- Components (Lazy Loaded) ---
const OrderMaster = React.lazy(() => import('./components/OrderMaster'));
const DataEntry = React.lazy(() => import('./components/DataEntry'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
import SettingsModule from './components/SettingsModule';
const SystemHealth = React.lazy(() => import('./components/SystemHealth'));
const AboutSection = React.lazy(() => import('./components/AboutSection'));
const ExcelLibrary = React.lazy(() => import('./components/ExcelLibrary'));
import Login from './components/Login';
import { FloatingAgent } from './components/FloatingAgent';

// --- Helper Components ---
const DigitalClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  const dateStr = format(time, 'dd MMM yy, EEE');
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col flex-1 leading-[1.2] items-start">
       <span className="text-[11px] font-black text-slate-200 uppercase">
         {dateStr}
       </span>
       <span className="text-[10px] font-black text-amber-500 font-mono mt-0.5">
         {timeStr}
       </span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; permissions?: string[]; status?: string; phone?: string; designation?: string; name?: string } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);

  // --- Dynamic Hierarchical Sorting (Buyer > Style > PO > Color) ---
  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const buyerCmp = (a.buyer || '').localeCompare(b.buyer || '');
      if (buyerCmp !== 0) return buyerCmp;
      const styleCmp = (a.style || '').localeCompare(b.style || '');
      if (styleCmp !== 0) return styleCmp;
      const poCmp = (a.poNo || '').localeCompare(b.poNo || '');
      if (poCmp !== 0) return poCmp;
      return (a.color || '').localeCompare(b.color || '');
    });
  }, [orders]);

  const [activeTab, setActiveTab] = useState('dash');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [appSettings, setAppSettings] = useState({
    primaryColor: '#f59e0b',
    fontSize: 'md',
    fontFamily: 'Inter, ui-sans-serif, system-ui',
    navPosition: 'top',
    compactMode: false,
    highContrast: false
  });
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'er' | 'in' }[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const reportBuilderRef = useRef<any>(null);

  const poLookupMap = useMemo(() => {
    const map = new Map<string, POInfo>();
    const poGroups: Record<string, Order[]> = {};
    
    sortedOrders.forEach(o => {
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
  }, [sortedOrders]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const infoA = poLookupMap.get(a.poNo);
      const infoB = poLookupMap.get(b.poNo);
      
      const buyerA = infoA?.buyer || '';
      const buyerB = infoB?.buyer || '';
      const buyerCmp = buyerA.localeCompare(buyerB);
      if (buyerCmp !== 0) return buyerCmp;
      
      const styleA = infoA?.style || '';
      const styleB = infoB?.style || '';
      const styleCmp = styleA.localeCompare(styleB);
      if (styleCmp !== 0) return styleCmp;
      
      const poCmp = (a.poNo || '').localeCompare(b.poNo || '');
      if (poCmp !== 0) return poCmp;
      
      const colorCmp = (a.color || '').localeCompare(b.color || '');
      if (colorCmp !== 0) return colorCmp;
      
      return (b.date || '').localeCompare(a.date || ''); // Fallback to Date Desc
    });
  }, [entries, poLookupMap]);

  const getPOInfo = useCallback((poNo: string): POInfo | null => {
    return poLookupMap.get(poNo) || null;
  }, [poLookupMap]);

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
            addToast('Account Suspended', 'er');
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- Persistence: Load App Settings from Firestore ---
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        const settingsRef = doc(db, 'settings', 'global');
        // Use getDocFromServer for initial boot to verify connectivity
        const settingsSnap = await getDocFromServer(settingsRef);
        if (settingsSnap.exists()) {
          const parsed = settingsSnap.data();
          setAppSettings(prev => ({ ...prev, ...parsed }));
          
          // Apply settings to DOM
          if (parsed.primaryColor) document.documentElement.style.setProperty('--color-accent', parsed.primaryColor);
          if (parsed.fontFamily) document.documentElement.style.setProperty('--font-sans', parsed.fontFamily);
          if (parsed.fontSize) {
            document.documentElement.style.fontSize = parsed.fontSize === 'sm' ? '14px' : parsed.fontSize === 'lg' ? '18px' : '16px';
          }
          if (parsed.highContrast !== undefined) {
             if (parsed.highContrast) document.documentElement.classList.add('contrast');
             else document.documentElement.classList.remove('contrast');
          }
        }
      } catch (err: any) {
        if (err.message?.includes('offline')) {
          console.warn("Firestore is offline. Settings loading skipped.");
        } else {
          console.error("Error loading app settings:", err);
        }
      }
    };
    loadSettings();
  }, []);

  const updateAppSettings = async (newSettings: any) => {
    setAppSettings(newSettings);
    // Persist to Firestore
    try {
      const { updatedAt, ...settingsToSave } = newSettings;
      await setDoc(doc(db, 'settings', 'global'), {
        ...settingsToSave,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error persisting settings:", err);
    }
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
  const addToast = useCallback((msg: string, type: 'ok' | 'er' | 'in' = 'ok') => {
    const id = Date.now() + toastCounter.current;
    toastCounter.current += 1;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const resetAll = () => {
    if (window.confirm('Reset all data to sample data?')) {
      setOrders(DEFAULT_ORDERS);
      setEntries(DEFAULT_ENTRIES);
      addToast('Data reset to sample', 'in');
    }
  };

  const downloadPDF = async () => {
    if (activeTab === 'custom-report' && reportBuilderRef.current) {
      await reportBuilderRef.current.exportToPDF();
      return;
    }

    setIsExporting(true);
    addToast('Preparing Vector Engine...', 'in');
    
    try {
      const jspdfMod = await import('jspdf');
      const jsPDFConstructor = (jspdfMod.jsPDF || (jspdfMod as any).default || jspdfMod) as any;
      const { default: autoTable } = await import('jspdf-autotable');

      const orientation = activeTab === 'master' || activeTab === 'entry' || activeTab === 'wip' || activeTab === 'dpr' || activeTab === 'status' ? 'l' : 'p';
      const doc = new jsPDFConstructor(orientation, 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      
      const reportDate = format(new Date(), 'dd-MMM-yy');
      const reportTime = format(new Date(), 'hh:mm:ss a');
      const userEmail = user?.email?.toUpperCase() || 'SYSTEM';

      // 1. Branding Header (Professional White Theme)
      // Clean white background
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      // Accent Stripe (Theme Yellow)
      doc.setFillColor(245, 158, 11);
      doc.rect(10, 32, pageWidth - 20, 1.5, 'F');
      
      // Branding text
      doc.setTextColor(15, 23, 42); // slate-900 (Black)
      doc.setFontSize(26);
      doc.setFont("helvetica", "bold");
      doc.text("ALPHA CLOTHING LTD.", 15, 18);
      
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("The Best Look Anytime Anywhere", 15, 24);
      doc.text("Tenguri, BKSP, Ashulia, Savar, Dhaka", 15, 28);

      // Report Info (Right Aligned)
      doc.setTextColor(245, 158, 11); // accent yellow
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      const reportTitle = activeTab === 'dash' ? 'DASHBOARD SUMMARY' : `${activeTab.replace('-', ' ').toUpperCase()} REPORT`;
      const titleWidth = doc.getTextWidth(reportTitle);
      doc.text(reportTitle, pageWidth - 15, 18, { align: 'right' });
      
      // Divider line in info block
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.5);
      doc.line(pageWidth - 15 - titleWidth, 20, pageWidth - 15, 20);

      doc.setTextColor(51, 65, 85); // slate-700
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(`PREPARED BY: ${userEmail}`, pageWidth - 15, 24, { align: 'right' });
      
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("helvetica", "normal");
      doc.text(`DATE: ${reportDate} | TIME: ${reportTime}`, pageWidth - 15, 28, { align: 'right' });

      // 2. Prepare Data (Sorted according to user preference: Buyer > Style > PO > Color)
      let headers: string[] = [];
      let body: any[][] = [];

      if (activeTab === 'master') {
        headers = ['SL', 'BUYER', 'STYLE', 'PO NO', 'SHIP DATE', 'COLOR', 'QTY'];
        body = sortedOrders.map((o, i) => [
          i + 1, 
          o.buyer, 
          o.style, 
          o.poNo, 
          o.shipDate ? format(parseISO(o.shipDate), 'dd-MMM-yy') : '—', 
          o.color, 
          o.orderQty.toLocaleString()
        ]);
      } else if (activeTab === 'entry') {
        headers = ['DATE', 'PO NO', 'COLOR', 'FLOOR', 'CUT', 'SEW', 'WASH', 'FIN IN', 'FIN OUT', 'POLY', 'SHIP'];
        body = sortedEntries.map(e => [
          e.date ? format(parseISO(e.date), 'dd-MMM-yy') : '—', 
          e.poNo, 
          e.color, 
          e.floor || 'N/A', 
          e.cut || 0, 
          e.sewOut || 0, 
          e.washR || 0, 
          e.finIn || 0, 
          e.finOut || 0, 
          e.poly || 0, 
          e.shipment || 0
        ]);
      } else if (activeTab === 'wip') {
        headers = ['BUYER', 'STYLE', 'PO NO', 'ORDER', 'CUT', 'SEW', 'WASH', 'FIN', 'POLY', 'SHIP'];
        // Sorting unique POs by Buyer > Style > PO via poLookupMap
        const uniquePOs: string[] = Array.from(new Set(sortedOrders.map(o => o.poNo)));
        body = uniquePOs.map((po: string) => {
          const info = getPOInfo(po);
          const poEnts = entries.filter(e => e.poNo === po);
          return [
            info?.buyer || 'N/A',
            info?.style || 'N/A',
            po,
            info?.totalQty.toLocaleString() || '0',
            poEnts.reduce((s, e) => s + (e.cut||0), 0).toLocaleString(),
            poEnts.reduce((s, e) => s + (e.sewOut||0), 0).toLocaleString(),
            poEnts.reduce((s, e) => s + (e.washR||0), 0).toLocaleString(),
            poEnts.reduce((s, e) => s + (e.finOut||0), 0).toLocaleString(),
            poEnts.reduce((s, e) => s + (e.poly||0), 0).toLocaleString(),
            poEnts.reduce((s, e) => s + (e.shipment||0), 0).toLocaleString(),
          ];
        });
      } else if (activeTab === 'dpr') {
        headers = ['DATE', 'BUYER', 'STYLE', 'PO NO', 'COLOR', 'CUT', 'SEW', 'WASH', 'FIN', 'POLY'];
        body = sortedEntries.slice(0, 500).map(e => {
          const info = getPOInfo(e.poNo);
          return [
            e.date ? format(parseISO(e.date), 'dd-MMM-yy') : '—', 
            info?.buyer || 'N/A', 
            info?.style || 'N/A', 
            e.poNo, 
            e.color, 
            (e.cut||0).toLocaleString(), 
            (e.sewOut||0).toLocaleString(), 
            (e.washR||0).toLocaleString(), 
            (e.finOut||0).toLocaleString(), 
            (e.poly||0).toLocaleString()
          ];
        });
      } else if (activeTab === 'dash') {
        headers = ['METRIC', 'VALUE'];
        const totalCut = entries.reduce((s, e) => s + (e.cut || 0), 0);
        const totalSew = entries.reduce((s, e) => s + (e.sewOut || 0), 0);
        const totalPoly = entries.reduce((s, e) => s + (e.poly || 0), 0);
        const totalShip = entries.reduce((s, e) => s + (e.shipment || 0), 0);
        const totalOrder = orders.reduce((s, o) => s + (o.orderQty || 0), 0);
        body = [
          ['Total Orders', orders.length],
          ['Total Order Qty', totalOrder.toLocaleString()],
          ['Total Cutting', totalCut.toLocaleString()],
          ['Total Sewing Out', totalSew.toLocaleString()],
          ['Total Poly/Finishing', totalPoly.toLocaleString()],
          ['Total Shipment', totalShip.toLocaleString()],
          ['Overall Achievement', totalOrder ? Math.round((totalPoly / totalOrder) * 100) + '%' : '0%']
        ];
      } else {
        headers = ['METRIC', 'VALUE'];
        body = [['Project Stat', 'Application Active']];
      }

      // 3. Generate Table
      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 45,
        theme: 'grid',
        styles: { 
          fontSize: 8.5, 
          cellPadding: 3, 
          halign: 'center', 
          textColor: [15, 23, 42],
          overflow: 'linebreak'
        },
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold',
          fontSize: 9.5,
          minCellHeight: 10
        },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      });

      doc.save(`ACL_${activeTab.toUpperCase()}_${format(new Date(), 'ddMMMyy_HHmm')}.pdf`);
      addToast('Vector PDF Generated Successfully', 'ok');
    } catch (error) {
      console.error('PDF Error:', error);
      addToast('Export System Error', 'er');
    } finally {
      setIsExporting(false);
    }
  };

  const exportExcel = async () => {
    if (activeTab === 'custom-report' && reportBuilderRef.current) {
      reportBuilderRef.current.exportToExcel();
      return;
    }

    setIsExporting(true);
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
        sortedOrders.forEach((o, i) => {
          rows.push([
            i + 1, 
            o.buyer, 
            o.style, 
            o.poNo, 
            o.shipDate ? format(parseISO(o.shipDate), 'dd-MMM-yy') : '—', 
            o.color, 
            o.orderQty
          ]);
        });
      } else if (activeTab === 'entry') {
        sheetName = "Production Entries";
        rows.push(['Date', 'PO No', 'Color', 'Floor', 'Cut', 'Sew Out', 'Wash R', 'Fin In', 'Fin Out', 'Poly', 'Shipment']);
        sortedEntries.forEach(e => {
          rows.push([
            e.date ? format(parseISO(e.date), 'dd-MMM-yy') : '—', 
            e.poNo, 
            e.color, 
            e.floor || 'N/A', 
            e.cut, 
            e.sewOut, 
            e.washR, 
            e.finIn, 
            e.finOut, 
            e.poly, 
            e.shipment
          ]);
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
        
        const uniquePOs: string[] = Array.from(new Set(sortedEntries.map(e => e.poNo)));
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
    } finally {
      setIsExporting(false);
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
    if (user?.email?.toLowerCase() === 'aknahian@gmail.com') return true;
    if (!userProfile) return false;
    if (userProfile.role === 'admin' || userProfile.role === 'super-admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const navPosition = appSettings.navPosition || 'top';

  const navTabs = [
    { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, color: 'text-sky-500', perm: 'view-data', mobile: true },
    { id: 'master', label: 'Orders', icon: Database, color: 'text-indigo-500', perm: 'view-data', mobile: true },
    { id: 'entry', label: 'Entry', icon: Keyboard, color: 'text-emerald-500', perm: 'view-data', mobile: true },
    { id: 'lib', label: 'Library', icon: Library, color: 'text-fuchsia-500', perm: 'manage-orders', mobile: true },
    { id: 'health', label: 'Health', icon: ShieldCheck, color: 'text-rose-500', perm: 'view-data' },
    { id: 'settings', label: 'Settings', icon: Settings2, color: 'text-slate-400', mobile: true },
  ];

  const filteredNavTabs = navTabs.filter(tab => !tab.perm || hasPermission(tab.perm));
  const mobileTabs = filteredNavTabs.filter(tab => tab.mobile);

  return (
     <div className="h-[100dvh] w-full bg-slate-950 text-fg font-sans flex flex-col overflow-hidden transition-colors relative">
      
      {/* Toast Notification Matrix */}
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="absolute top-16 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                className={cn(
                  "p-3 rounded-lg shadow-2xl flex items-center gap-3 backdrop-blur-3xl border text-[10px] font-bold uppercase tracking-widest pointer-events-auto min-w-[280px] relative overflow-hidden",
                  t.type === 'ok' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                  t.type === 'er' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
                  "bg-sky-500/10 text-sky-400 border-sky-500/20"
                )}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-current/5 to-transparent pointer-events-none" />
                <div className={cn(
                   "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner",
                   t.type === 'ok' ? "bg-emerald-500/20" : t.type === 'er' ? "bg-rose-500/20" : "bg-sky-500/20"
                )}>
                  {t.type === 'ok' && <CheckCircle2 size={16} />}
                  {t.type === 'er' && <AlertCircle size={16} />}
                  {t.type === 'in' && <InfoIcon size={16} />}
                </div>
                <div className="flex flex-col">
                   <div className="opacity-70 text-[8px] tracking-[0.2em] font-black">System</div>
                   <div className="text-white/90">{t.msg}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Floating Frozen Top Header */}
      <div className="flex-none bg-slate-950 border-b border-indigo-500/20 z-50 sticky top-0 shadow-xl relative grid">
         {/* Top Header Background Glow */}
         <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
         
         {/* Line 1: Workspace Utilities */}
         <div className="flex items-center justify-between px-2 md:px-4 py-2 border-b border-white/5 h-14 bg-slate-900/50">
            
            {/* Left side: Brand */}
            <div className="flex flex-col items-start text-left shrink-0">
               <span className="text-[14px] md:text-[18px] font-black tracking-wider text-emerald-400 hidden sm:block leading-none uppercase drop-shadow-md">
                  ALPHA CLOTHING LTD.
               </span>
               <span className="text-[12px] font-black tracking-wider text-emerald-400 sm:hidden leading-none uppercase drop-shadow-md">
                  ALPHA
               </span>
               <span className="text-[9px] md:text-[10px] font-bold text-slate-300 tracking-wider uppercase mt-1.5 hidden sm:block">
                  The Best Look Anytime Anywhere
               </span>
            </div>

            {/* Right side: AI -> Download -> Date/Time -> User Profile */}
            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-0 sm:ml-auto w-full sm:w-auto overflow-x-auto no-scrollbar shrink-0 justify-end h-full py-2">
               
               {/* 1st: AI Icon */}
               <div className="flex items-center gap-2 bg-slate-800/60 px-2 py-1.5 rounded-lg border border-white/5 shadow-sm min-w-[70px] cursor-pointer hover:bg-slate-800 transition-colors" title="AI Assistant Active">
                  <div className="text-indigo-400 bg-indigo-500/10 p-1.5 rounded-md">
                     <Bot size={14} strokeWidth={2.5} />
                  </div>
                  <div className="hidden lg:flex flex-col text-left leading-[1.1]">
                     <span className="text-[10px] font-black uppercase text-[#a8b1ff] tracking-wider">AI</span>
                     <span className="text-[8px] text-slate-400 font-bold tracking-widest uppercase mt-0.5">Active</span>
                  </div>
               </div>

               {/* 2nd: Download Dropdown */}
               <div className="relative h-full flex items-center shrink-0">
                  <button 
                     onClick={() => setIsDownloadOpen(!isDownloadOpen)} 
                     className="bg-slate-800/60 border border-white/5 text-slate-300 hover:bg-slate-800 hover:text-white transition-all flex items-center gap-2 px-2 py-1.5 rounded-lg shadow-sm"
                  >
                     <div className="text-amber-400 bg-amber-500/10 p-1.5 rounded-md">
                        <Download size={14} strokeWidth={2.5} />
                     </div>
                     <div className="hidden lg:flex flex-col text-left pr-2 leading-[1.1]">
                        <span className="text-[10px] font-black uppercase tracking-wider">Download</span>
                        <span className="text-[8px] opacity-70 font-bold tracking-widest uppercase mt-0.5">Report</span>
                     </div>
                  </button>
                  <AnimatePresence>
                     {isDownloadOpen && (
                        <motion.div key="download-menu" className="relative z-50">
                           <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsDownloadOpen(false)} 
                           />
                           <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 5 }} 
                              animate={{ opacity: 1, scale: 1, y: 0 }} 
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 top-full mt-2 w-[160px] bg-slate-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1.5 z-50 origin-top-right"
                           >
                              <button 
                                 onClick={() => { downloadPDF(); setIsDownloadOpen(false); }}
                                 className="w-full text-left px-3 py-2.5 hover:bg-white/5 text-[10px] font-black text-slate-300 hover:text-white flex items-center gap-2.5 uppercase tracking-wider transition-colors"
                              >
                                 <FileText size={14} className="text-rose-400" /> PDF Report
                              </button>
                              <button 
                                 onClick={() => { exportExcel(); setIsDownloadOpen(false); }}
                                 className="w-full text-left px-3 py-2.5 hover:bg-white/5 text-[10px] font-black text-slate-300 hover:text-white flex items-center gap-2.5 uppercase tracking-wider transition-colors"
                              >
                                 <FileSpreadsheet size={14} className="text-emerald-400" /> Excel Sheet
                              </button>
                           </motion.div>
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>

               {/* 3rd: Time and Date */}
               <div className="flex items-center gap-3 bg-slate-800/60 px-3 py-1.5 rounded-lg border border-white/5 shadow-sm min-w-[140px] shrink-0">
                  <div className="hidden sm:block">
                     <DigitalClock />
                  </div>
               </div>

               {/* 4th: User Icon / Profile */}
               <div className="relative shrink-0 flex items-center h-full">
                  <button 
                     onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                     className="flex items-center gap-2 bg-slate-800/60 hover:bg-slate-800 p-1.5 pr-3 rounded-lg transition-colors border border-white/5 shadow-sm min-w-[120px]"
                  >
                     <div className="w-8 h-8 rounded-md bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-inner shrink-0">
                        {user.email?.charAt(0).toUpperCase()}
                     </div>
                     <div className="hidden lg:flex flex-col text-left leading-[1.1]">
                        <span className="text-[11px] font-black text-slate-200 capitalize truncate w-full max-w-[100px]">{userProfile?.name || user.email?.split('@')[0]}</span>
                        <span className="text-[8px] font-bold text-sky-400 uppercase tracking-widest mt-0.5">{userProfile?.role || 'Guest'}</span>
                     </div>
                  </button>
                  
                  <AnimatePresence>
                     {isUserMenuOpen && (
                        <motion.div key="user-menu" className="relative z-50">
                           <div 
                              className="fixed inset-0 z-40" 
                              onClick={() => setIsUserMenuOpen(false)} 
                           />
                           <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: 5 }} 
                              animate={{ opacity: 1, scale: 1, y: 0 }} 
                              exit={{ opacity: 0, scale: 0.95, y: 5 }}
                              className="absolute right-0 top-full mt-2 w-72 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2 z-50 origin-top-right flex flex-col"
                           >
                              <div className="px-5 py-4 border-b border-white/10 flex items-center gap-4 bg-white/5">
                                 <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-black text-xl shadow-inner shrink-0">
                                    {user.email?.charAt(0).toUpperCase()}
                                 </div>
                                 <div className="flex flex-col overflow-hidden w-full">
                                    <span className="text-sm font-black text-white capitalize truncate">{userProfile?.name || user.email?.split('@')[0]}</span>
                                    <span className="text-[10px] font-bold text-sky-400 uppercase tracking-widest mt-1">{userProfile?.role || 'Guest'}</span>
                                 </div>
                              </div>
                              
                              <div className="px-5 py-4 flex flex-col gap-3 border-b border-white/10 text-xs">
                                 <div className="flex items-center gap-3 text-slate-300">
                                    <Mail size={14} className="text-slate-500 shrink-0" />
                                    <span className="truncate">{user.email}</span>
                                 </div>
                                 <div className="flex items-center gap-3 text-slate-300">
                                    <Phone size={14} className="text-slate-500 shrink-0" />
                                    <span>{userProfile?.phone || '+880 1700 000000'}</span>
                                 </div>
                                 <div className="flex items-center gap-3 text-slate-300">
                                    <Briefcase size={14} className="text-slate-500 shrink-0" />
                                    <span className="truncate">{userProfile?.designation || 'Head of IT & Operations'}</span>
                                 </div>
                              </div>

                              <div className="p-2">
                                 <button 
                                    onClick={() => { toggleTheme(); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-bold text-slate-300 hover:text-white flex items-center gap-3 transition-colors"
                                 >
                                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                                    Toggle Theme
                                 </button>
                                 <button 
                                    onClick={() => { handleLogout(); setIsUserMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-3 transition-colors mt-1 border border-transparent hover:border-rose-500/20"
                                 >
                                    <LogOut size={15} />
                                    Sign Out
                                 </button>
                              </div>
                           </motion.div>
                        </motion.div>
                     )}
                  </AnimatePresence>
               </div>
            </div>
         </div>

         {/* Line 2: Horizontal Scroll Navigation */}
         <div className="flex items-center overflow-x-auto no-scrollbar px-2 py-1.5 h-12 relative w-full items-center justify-between">
            <div className="flex items-center gap-2 px-2 shrink-0">
               {filteredNavTabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                     <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                           "flex items-center gap-2 px-4 py-1.5 rounded-full whitespace-nowrap transition-all text-[11px] uppercase tracking-widest font-black shrink-0 border relative overflow-hidden group",
                           isActive 
                              ? `bg-slate-800 ${tab.color} border-white/10 shadow-[inset_0_1px_rgba(255,255,255,0.05)]` 
                              : "text-slate-500 hover:text-white border-transparent hover:bg-slate-800/50"
                        )}
                     >
                        {isActive && <div className={cn("absolute inset-0 opacity-10 bg-current")} />}
                        <tab.icon size={14} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
                        <span className="relative z-10">{tab.label}</span>
                     </button>
                  );
               })}
            </div>
            
            <div className="flex flex-1" />
            
            <div className="flex items-center gap-3 shrink-0 px-3 border-l border-white/5 ml-2">
               <button onClick={toggleTheme} className="text-slate-400 hover:text-amber-400 transition-colors" title="Toggle Theme">
                  {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
               </button>
               <button onClick={handleLogout} className="text-slate-400 hover:text-rose-400 transition-colors" title="Logout">
                  <RefreshCw size={15} />
               </button>
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse ml-2" title="System Live" />
            </div>
         </div>
      </div>

      {/* Main Workspace Workspace */}
      <div id="report-content" className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-6 relative z-10">
         <React.Suspense fallback={
            <div className="h-full flex flex-col items-center justify-center opacity-60 gap-4">
               <div className="w-10 h-10 rounded-full border-[3px] border-indigo-500/20 border-t-indigo-500 animate-spin" />
               <h3 className="text-[10px] font-black text-indigo-400 tracking-[0.2em] uppercase">Loading System...</h3>
            </div>
         }>
            <AnimatePresence mode="wait">
               <motion.div
                 key={activeTab}
                 initial={{ opacity: 0, filter: 'blur(4px)', y: 10 }}
                 animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                 exit={{ opacity: 0, filter: 'blur(4px)', y: -10 }}
                 transition={{ duration: 0.3 }}
                 className="mx-auto w-full max-w-[1900px] min-h-full"
               >
                 {activeTab === 'dash' && <Dashboard orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} poColorAggregates={aggregates.poColorMap} />}
                 {activeTab === 'master' && <OrderMaster orders={sortedOrders} addToast={addToast} userProfile={userProfile} />}
                 {activeTab === 'entry' && <DataEntry orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />}
                 {activeTab === 'lib' && <ExcelLibrary />}
                 {activeTab === 'health' && <SystemHealth orders={sortedOrders} entries={sortedEntries} />}
                 {activeTab === 'settings' && (
                   <SettingsModule 
                     orders={orders} 
                     entries={entries} 
                     userProfile={userProfile}
                     currentTheme={theme}
                     setTheme={setTheme}
                     appSettings={appSettings}
                     updateAppSettings={updateAppSettings}
                     onLogout={handleLogout}
                   />
                 )}
               </motion.div>
            </AnimatePresence>
         </React.Suspense>
      </div>

      <FloatingAgent />
    </div>
  );
}