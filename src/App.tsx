import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  ArrowRight,
  ArrowUp,
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
  CalendarDays,
  Truck,
  PieChart,
  Waves,
  FolderOpen,
  Library,
  Box as BoxIcon,
  Target,
  Shield,
  ShieldCheck,
  ClipboardList,
  Save,
  Eraser,
  Tag,
  Sun,
  Moon,
  Download,
  ChevronRight,
  Sparkles,
  FileSpreadsheet,
  Settings2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';
import { cn } from './lib/utils';
import { Order, ProductionEntry, POInfo } from './types';
import { DEFAULT_ORDERS, DEFAULT_ENTRIES, BUYERS } from './constants';
import { auth, db } from './firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, doc, getDoc, setDoc } from 'firebase/firestore';

// --- Components (Lazy Loaded) ---
const OrderMaster = React.lazy(() => import('./components/OrderMaster'));
const DataEntry = React.lazy(() => import('./components/DataEntry'));
const DPRReport = React.lazy(() => import('./components/DPRReport'));
const WIPReport = React.lazy(() => import('./components/WIPReport'));
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const StatusReport = React.lazy(() => import('./components/OrderStatus'));
import SettingsModule from './components/SettingsModule';
const SystemHealth = React.lazy(() => import('./components/SystemHealth'));
const FinishingTracker = React.lazy(() => import('./components/FinishingTracker'));
const ShipmentSchedule = React.lazy(() => import('./components/ShipmentSchedule'));
const ReportBuilder = React.lazy(() => import('./components/ReportBuilder'));
const AboutSection = React.lazy(() => import('./components/AboutSection'));
const ExcelLibrary = React.lazy(() => import('./components/ExcelLibrary'));
import Login from './components/Login';

// --- Helper Components ---
const DigitalClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-end">
       <span className="text-[11px] font-black text-fg leading-none font-mono">
         {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
       </span>
       <span className="text-[8px] font-black text-muted uppercase tracking-[0.1em] mt-1">
         {time.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
       </span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<{ role: string; permissions?: string[]; status?: string } | null>(null);
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
        const settingsRef = doc(db, 'settings', 'global');
        const settingsSnap = await getDoc(settingsRef);
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
      } catch (err) {
        console.error("Error loading app settings:", err);
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
        headers = ['DATE', 'PO NO', 'COLOR', 'LINE', 'CUT', 'SEW', 'WASH', 'FIN IN', 'FIN OUT', 'POLY', 'SHIP'];
        body = sortedEntries.map(e => [
          e.date ? format(parseISO(e.date), 'dd-MMM-yy') : '—', 
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
        rows.push(['Date', 'PO No', 'Color', 'Line/Floor', 'Cut', 'Sew Out', 'Wash R', 'Fin In', 'Fin Out', 'Poly', 'Shipment']);
        sortedEntries.forEach(e => {
          rows.push([
            e.date ? format(parseISO(e.date), 'dd-MMM-yy') : '—', 
            e.poNo, 
            e.color, 
            e.lineNo || e.floor || 'N/A', 
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
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const navPosition = appSettings.navPosition || 'top';

  const navTabs = [
    { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, perm: 'view-data', mobile: true },
    { id: 'master', label: 'Orders', icon: Database, perm: 'view-data', mobile: true },
    { id: 'ship-schedule', label: 'Schedule', icon: Truck, perm: 'view-data', mobile: true },
    { id: 'entry', label: 'Entry', icon: Keyboard, perm: 'view-data', mobile: true },
    { id: 'fin-track', label: 'Finishing', icon: Waves, perm: 'view-data' },
    { id: 'custom-report', label: 'Analytics', icon: PieChart, perm: 'view-data' },
    { id: 'status', label: 'Tracking', icon: Target, perm: 'view-data' },
    { id: 'dpr', label: 'DPR', icon: ClipboardList, perm: 'view-data' },
    { id: 'wip', label: 'WIP Audit', icon: Activity, perm: 'view-data' },
    { id: 'lib', label: 'Library', icon: Library, perm: 'manage-orders', mobile: true },
    { id: 'health', label: 'Health', icon: ShieldCheck, perm: 'view-data' },
    { id: 'settings', label: 'Settings', icon: Settings2, mobile: true },
  ];

  const filteredNavTabs = navTabs.filter(tab => !tab.perm || hasPermission(tab.perm));
  const mobileTabs = filteredNavTabs.filter(tab => tab.mobile);

  return (
    <div className={cn(
      "h-screen h-[100dvh] bg-bg text-fg font-sans selection:bg-accent selection:text-slate-950 flex flex-col md:flex-row overflow-hidden transition-all duration-500",
    )}>
      {/* Toast Notification Matrix */}
      <AnimatePresence>
        {toasts.length > 0 && (
          <div className="fixed top-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 50, filter: 'blur(10px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: 20, filter: 'blur(5px)' }}
                className={cn(
                  "p-4 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-3xl border border-white/10 text-[10px] font-black uppercase tracking-widest pointer-events-auto min-w-[320px] relative overflow-hidden",
                  t.type === 'ok' ? "bg-success/10 text-success border-success/30" : 
                  t.type === 'er' ? "bg-danger/10 text-danger border-danger/30" : 
                  "bg-info/10 text-info border-info/30"
                )}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-50" />
                <div className="w-8 h-8 rounded-lg bg-current/10 flex items-center justify-center shrink-0">
                  {t.type === 'ok' && <CheckCircle2 size={16} />}
                  {t.type === 'er' && <AlertCircle size={16} />}
                  {t.type === 'in' && <InfoIcon size={16} />}
                </div>
                <div className="flex flex-col gap-1">
                   <div className="opacity-60 text-[8px] tracking-[0.2em]">System Alert</div>
                   <div>{t.msg}</div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Navigation Core (Collapsible Sidebar) - Smart & Narrow */}
      <aside 
        className={cn(
          "hidden md:flex flex-col bg-bg2/40 border-r border-border/40 backdrop-blur-3xl transition-all duration-500 ease-in-out relative z-50 no-print",
          isSidebarCollapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Sidebar Toggle Pivot */}
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="absolute -right-3 top-10 w-6 h-6 bg-accent rounded-full flex items-center justify-center text-slate-950 shadow-lg z-[60] hover:scale-110 active:scale-95 transition-all border-2 border-bg"
        >
          <motion.div animate={{ rotate: isSidebarCollapsed ? 0 : 180 }}>
            <ChevronRight size={14} />
          </motion.div>
        </button>

        {/* Brand Matrix */}
        <div className="h-16 px-5 flex items-center gap-4 border-b border-border/20 overflow-hidden shrink-0">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shrink-0 shadow-lg group">
            <Target size={22} className="text-slate-950 group-hover:scale-110 transition-transform" />
          </div>
          <AnimatePresence>
            {!isSidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                className="whitespace-nowrap"
              >
                <div className="text-[14px] font-black uppercase tracking-tighter leading-none mb-0.5 italic">ALPHA<span className="text-accent underline underline-offset-4">ERP</span></div>
                <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted leading-none">Core Operations</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation Matrix */}
        <nav className="flex-1 overflow-y-auto no-scrollbar px-3 py-6 space-y-1">
          {filteredNavTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center transition-all duration-300 rounded-xl relative group overflow-hidden h-11 px-3",
                activeTab === tab.id 
                  ? "bg-accent text-slate-950 font-black shadow-lg shadow-accent/20" 
                  : "text-muted hover:bg-white/5 hover:text-fg"
              )}
              title={isSidebarCollapsed ? tab.label : ""}
            >
              <tab.icon size={20} className={cn("shrink-0 transition-transform group-hover:scale-110", activeTab === tab.id ? "" : "opacity-60")} />
              <AnimatePresence>
                {!isSidebarCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap ml-4"
                  >
                    {tab.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {activeTab === tab.id && (
                <motion.div layoutId="side-tab-bar" className="absolute left-0 w-0.5 h-4 bg-slate-950 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        {/* Sidebar Status Matrix */}
        <div className="p-3 border-t border-border/20 bg-slate-950/20">
           <div className={cn("flex flex-col gap-1", isSidebarCollapsed ? "items-center" : "")}>
              <button onClick={toggleTheme} className="w-full flex items-center px-3 py-2.5 rounded-xl text-muted hover:bg-white/5 transition-all group" title="Theme Matrix">
                 {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                 {!isSidebarCollapsed && <span className="text-[9px] font-black uppercase tracking-widest ml-4">Interface Theme</span>}
              </button>
              <button onClick={downloadPDF} className="w-full flex items-center px-3 py-2.5 rounded-xl text-muted hover:bg-white/5 transition-all group" title="System Export">
                 <Download size={20} className="group-hover:text-accent" />
                 {!isSidebarCollapsed && <span className="text-[9px] font-black uppercase tracking-widest ml-4">Full Report</span>}
              </button>
              <button onClick={handleLogout} className="w-full flex items-center px-3 py-2.5 rounded-xl text-danger/60 hover:bg-danger/10 hover:text-danger transition-all group" title="Emergency Sign Out">
                 <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-700" />
                 {!isSidebarCollapsed && <span className="text-[9px] font-black uppercase tracking-widest ml-4">Secure Sign-out</span>}
              </button>
           </div>
        </div>
      </aside>

      {/* Main Framework Viewport */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-bg relative">
         {/* Static Overlay Noise */}
         <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')] z-0" />
         
         {/* Smart Status Bar - Narrow & Professional */}
         <header className="h-14 px-6 border-b border-border/20 flex items-center justify-between no-print z-10 backdrop-blur-2xl">
            <div className="flex items-center gap-6">
               <div className="md:hidden p-2 text-muted" onClick={() => setIsMobileMenuOpen(true)}>
                  <LayoutDashboard size={20} />
               </div>
               <div className="flex items-center gap-3">
                  <span className="sst text-[8px] opacity-40">System Core</span>
                  <ChevronRight size={10} className="text-muted/20" />
                  <span className="st text-sm tracking-[0.2em]">{filteredNavTabs.find(t => t.id === activeTab)?.label}</span>
               </div>
            </div>
            
            <div className="flex items-center gap-8">
               <div className="hidden lg:flex items-center gap-6 border-r border-border/20 pr-8">
                  <DigitalClock />
                  <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-[11px] font-black text-accent shadow-inner">
                     {user.email?.charAt(0).toUpperCase()}
                  </div>
               </div>
               <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(34,197,94,1)]" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-success">Secure Real-time</span>
               </div>
            </div>
         </header>

         {/* Dynamic Grid Viewport */}
         <div id="report-content" className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-24 md:pb-6 relative z-10">
            <React.Suspense fallback={
               <div className="h-full flex flex-col items-center justify-center opacity-30 gap-6">
                  <div className="w-16 h-16 border-4 border-accent/10 border-t-accent rounded-full animate-spin shadow-2xl shadow-accent/20" />
                  <div className="flex flex-col items-center gap-2">
                     <p className="text-[12px] font-black uppercase tracking-[0.4em] animate-pulse">Synchronizing Interface</p>
                     <p className="text-[8px] font-black uppercase tracking-[0.1em] text-muted">Alpha Core Matrix v5.5.4</p>
                  </div>
               </div>
            }>
               <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
                    transition={{ duration: 0.3 }}
                    className="mx-auto w-full max-w-[1800px]"
                  >
                    {activeTab === 'dash' && <Dashboard orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} poColorAggregates={aggregates.poColorMap} />}
                    {activeTab === 'master' && <OrderMaster orders={sortedOrders} addToast={addToast} userProfile={userProfile} />}
                    {activeTab === 'ship-schedule' && <ShipmentSchedule orders={sortedOrders} />}
                    {activeTab === 'entry' && <DataEntry orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} addToast={addToast} userProfile={userProfile} />}
                    {activeTab === 'fin-track' && <FinishingTracker orders={sortedOrders} entries={sortedEntries} addToast={addToast} userProfile={userProfile} />}
                    {activeTab === 'status' && <StatusReport orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} poColorAggregates={aggregates.poColorMap} />}
                    {activeTab === 'dpr' && <DPRReport orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} />}
                    {activeTab === 'wip' && <WIPReport orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} poAggregates={aggregates.poMap} />}
                    {activeTab === 'lib' && <ExcelLibrary />}
                    {activeTab === 'custom-report' && <ReportBuilder ref={reportBuilderRef} orders={sortedOrders} entries={sortedEntries} getPOInfo={getPOInfo} />}
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

         {/* Compact Footer Bar */}
         <footer className="h-10 bg-bg2/80 border-t border-border/20 px-6 flex items-center justify-between no-print shrink-0 relative z-20 backdrop-blur-3xl">
            <div className="flex items-center gap-4">
               <span className="text-[9px] font-black text-muted uppercase tracking-widest pl-2 border-l border-accent/30">System Ready</span>
            </div>
            <div className="flex items-center gap-6 divide-x divide-white/5">
               <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em] pl-6">Core Engine v5.54</span>
               <span className="hidden sm:block text-[9px] font-black text-muted uppercase tracking-[0.2em] pl-6">Access: {userProfile?.role?.toUpperCase()}</span>
            </div>
         </footer>
      </main>

      {/* Mobile Framework - Minimal Nav */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-bg2/90 backdrop-blur-3xl border-t border-border/40 h-16 flex items-center justify-around px-2 z-[100] no-print">
         {mobileTabs.slice(0, 4).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex flex-col items-center gap-1 w-12", activeTab === tab.id ? "text-accent" : "text-muted")}>
               <tab.icon size={20} />
               <span className="text-[8px] font-black uppercase tracking-tight">{tab.label.split(' ')[0]}</span>
            </button>
         ))}
         <button onClick={() => setIsMobileMenuOpen(true)} className="flex flex-col items-center gap-1 text-muted w-12">
            <Plus size={20} />
            <span className="text-[8px] font-black uppercase tracking-tight">Menu</span>
         </button>
      </nav>

      {/* Mobile Sidebar Overlay Matrix */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200]" />
            <motion.div 
               initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
               className="fixed inset-y-0 left-0 w-[85%] max-w-[320px] bg-bg border-r border-border/50 z-[201] flex flex-col p-6 shadow-3xl"
            >
               <div className="flex items-center justify-between mb-10">
                  <div className="st">Operations</div>
                  <X size={20} onClick={() => setIsMobileMenuOpen(false)} />
               </div>
               <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                  {filteredNavTabs.map(tab => (
                     <button key={tab.id} onClick={() => { setActiveTab(tab.id); setIsMobileMenuOpen(false); }} className={cn("w-full flex items-center gap-4 p-4 rounded-xl", activeTab === tab.id ? "bg-accent text-slate-950 font-bold" : "text-muted hover:bg-white/5")}>
                        <tab.icon size={20} />
                        <span className="text-xs uppercase tracking-widest">{tab.label}</span>
                     </button>
                  ))}
               </div>
               <div className="mt-auto pt-6 border-t border-border/20 space-y-4">
                  <div className="flex items-center justify-between">
                     <span className="sst">Theme Mode</span>
                     <button onClick={toggleTheme} className="p-3 bg-white/5 rounded-xl">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
                  </div>
                  <button onClick={handleLogout} className="w-full py-4 bg-danger/10 text-danger rounded-xl text-[10px] font-black uppercase tracking-widest">Secure Exit</button>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
