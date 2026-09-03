import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, Users, FileText, LogOut, Moon, Sun, Plus, Search, Edit2, Trash2, Eye, Download, Share2,
  CreditCard, Banknote, TrendingUp, AlertTriangle, Calendar, Phone, MapPin, Mail, User, Lock, Store,
  ArrowLeft, ChevronRight, Save, X, Menu, Wallet, History, BarChart3, PieChart as PieIcon, Settings,
  MessageCircle, Camera, RefreshCw, Upload, Database, FileSpreadsheet
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, parseISO, differenceInDays, isToday, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn } from './lib/utils';

// Types
type User = { id: string; name: string; email: string; password: string; created_at: string };
type Customer = { id: string; user_id: string; name: string; phone: string; address: string; email: string; created_at: string };
type Transaction = { id: string; customer_id: string; user_id: string; type: 'credit' | 'payment'; amount: number; description: string; note: string; transaction_date: string; created_at: string };

// Helpers
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtMoney = (n: number) => '৳ ' + n.toLocaleString('bn-BD');
const fmtDate = (s: string) => {
  if (!s) return '—';
  try { return format(parseISO(s), 'dd MMM yyyy'); } catch { return s; }
};
const fmtDateTime = (s: string) => {
  try { return format(parseISO(s), 'dd MMM yyyy, hh:mm a'); } catch { return s; }
};

export default function App() {
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('sl_theme') as any) || 'light');
  useEffect(() => {
    localStorage.setItem('sl_theme', theme);
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  // Auth
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const t = localStorage.getItem('sl_session');
    return t ? JSON.parse(t) : null;
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [profileForm, setProfileForm] = useState({ name: '', email: '' });

  // App state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'customers' | 'ledger' | 'reports' | 'profile'>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (!currentUser) return [];
    const raw = localStorage.getItem(`sl_customers_${currentUser.id}`);
    return raw ? JSON.parse(raw) : [];
  });
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    if (!currentUser) return [];
    const raw = localStorage.getItem(`sl_tx_${currentUser.id}`);
    return raw ? JSON.parse(raw) : [];
  });
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', address: '', email: '' });
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txForm, setTxForm] = useState<{ type: 'credit' | 'payment'; amount: string; description: string; note: string; transaction_date: string }>({ type: 'credit', amount: '', description: '', note: '', transaction_date: todayISO() });
  const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'er' | 'in' }[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const ledgerRef = useRef<HTMLDivElement>(null);

  // Persist customers/tx per user
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`sl_customers_${currentUser.id}`, JSON.stringify(customers));
    }
  }, [customers, currentUser]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`sl_tx_${currentUser.id}`, JSON.stringify(transactions));
    }
  }, [transactions, currentUser]);

  // Load per user when user changes
  useEffect(() => {
    if (currentUser) {
      const cRaw = localStorage.getItem(`sl_customers_${currentUser.id}`);
      const tRaw = localStorage.getItem(`sl_tx_${currentUser.id}`);
      setCustomers(cRaw ? JSON.parse(cRaw) : []);
      setTransactions(tRaw ? JSON.parse(tRaw) : []);
      setProfileForm({ name: currentUser.name, email: currentUser.email });
      // seed demo data if empty and first time
      if (!cRaw) {
        const demoCustomers: Customer[] = [
          { id: uid(), user_id: currentUser.id, name: 'করিম ট্রেডার্স', phone: '01711223344', address: 'চকবাজার, ঢাকা', email: '', created_at: new Date(Date.now() - 40 * 24 * 3600 * 1000).toISOString() },
          { id: uid(), user_id: currentUser.id, name: 'রহিম স্টোর', phone: '01855667788', address: 'মিরপুর-১০, ঢাকা', email: 'rahim@example.com', created_at: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString() },
          { id: uid(), user_id: currentUser.id, name: 'মা ফ্যাশন হাউস', phone: '01999887766', address: 'নিউ মার্কেট, চট্টগ্রাম', email: '', created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
        ];
        const demoTx: Transaction[] = [
          { id: uid(), customer_id: demoCustomers[0].id, user_id: currentUser.id, type: 'credit', amount: 15000, description: 'থান কাপড় ২০ পিস', note: 'বাকিতে দেওয়া', transaction_date: format(subDays(new Date(), 35), 'yyyy-MM-dd'), created_at: new Date().toISOString() },
          { id: uid(), customer_id: demoCustomers[0].id, user_id: currentUser.id, type: 'payment', amount: 5000, description: 'আংশিক পরিশোধ', note: '', transaction_date: format(subDays(new Date(), 10), 'yyyy-MM-dd'), created_at: new Date().toISOString() },
          { id: uid(), customer_id: demoCustomers[1].id, user_id: currentUser.id, type: 'credit', amount: 8500, description: 'শার্ট ১৫ পিস', note: '', transaction_date: format(subDays(new Date(), 2), 'yyyy-MM-dd'), created_at: new Date().toISOString() },
          { id: uid(), customer_id: demoCustomers[1].id, user_id: currentUser.id, type: 'credit', amount: 3200, description: 'পাঞ্জাবি ৮ পিস', note: '', transaction_date: todayISO(), created_at: new Date().toISOString() },
          { id: uid(), customer_id: demoCustomers[2].id, user_id: currentUser.id, type: 'credit', amount: 22000, description: 'শাড়ি ১০ পিস', note: 'ঈদের জন্য', transaction_date: todayISO(), created_at: new Date().toISOString() },
          { id: uid(), customer_id: demoCustomers[2].id, user_id: currentUser.id, type: 'payment', amount: 7000, description: 'জমা', note: '', transaction_date: todayISO(), created_at: new Date().toISOString() },
        ];
        setCustomers(demoCustomers);
        setTransactions(demoTx);
      }
    } else {
      setCustomers([]);
      setTransactions([]);
    }
  }, [currentUser?.id]);

  const addToast = (msg: string, type: 'ok' | 'er' | 'in' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  // Auth handlers
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authForm.name || !authForm.email || !authForm.password) return addToast('সব ঘর পূরণ করুন', 'er');
    if (authForm.password.length < 6) return addToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে', 'er');
    const usersRaw = localStorage.getItem('sl_users');
    const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
    if (users.find(u => u.email.toLowerCase() === authForm.email.toLowerCase())) return addToast('এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে', 'er');
    const newUser: User = { id: uid(), name: authForm.name, email: authForm.email.toLowerCase(), password: authForm.password, created_at: new Date().toISOString() };
    users.push(newUser);
    localStorage.setItem('sl_users', JSON.stringify(users));
    localStorage.setItem('sl_session', JSON.stringify(newUser));
    setCurrentUser(newUser);
    setActiveTab('dashboard');
    addToast('সফলভাবে রেজিস্ট্রেশন সম্পন্ন!', 'ok');
  };
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const usersRaw = localStorage.getItem('sl_users');
    const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
    const u = users.find(x => x.email.toLowerCase() === authForm.email.toLowerCase() && x.password === authForm.password);
    if (!u) return addToast('ভুল ইমেইল বা পাসওয়ার্ড', 'er');
    localStorage.setItem('sl_session', JSON.stringify(u));
    setCurrentUser(u);
    setActiveTab('dashboard');
    addToast(`স্বাগতম, ${u.name}!`, 'ok');
  };
  const handleLogout = () => {
    localStorage.removeItem('sl_session');
    setCurrentUser(null);
    setAuthForm({ name: '', email: '', password: '' });
    setSelectedCustomerId(null);
    addToast('লগআউট সফল', 'in');
  };
  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!profileForm.name || !profileForm.email) return addToast('নাম ও ইমেইল আবশ্যক', 'er');
    const usersRaw = localStorage.getItem('sl_users');
    const users: User[] = usersRaw ? JSON.parse(usersRaw) : [];
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
      if (users.some(u => u.id !== currentUser.id && u.email.toLowerCase() === profileForm.email.toLowerCase())) return addToast('এই ইমেইল অন্য কেউ ব্যবহার করছে', 'er');
      users[idx].name = profileForm.name;
      users[idx].email = profileForm.email.toLowerCase();
      localStorage.setItem('sl_users', JSON.stringify(users));
      const updated = users[idx];
      localStorage.setItem('sl_session', JSON.stringify(updated));
      setCurrentUser(updated);
      addToast('প্রোফাইল আপডেট হয়েছে', 'ok');
    }
  };

  // Customer handlers
  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', address: '', email: '' });
    setIsCustomerModalOpen(true);
  };
  const openEditCustomer = (c: Customer) => {
    setEditingCustomer(c);
    setCustomerForm({ name: c.name, phone: c.phone, address: c.address, email: c.email });
    setIsCustomerModalOpen(true);
  };
  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerForm.name || !customerForm.phone) return addToast('নাম ও মোবাইল আবশ্যক', 'er');
    if (!/^[0-9+\- ]{8,16}$/.test(customerForm.phone)) return addToast('সঠিক মোবাইল নম্বর দিন', 'er');
    if (editingCustomer) {
      setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, ...customerForm } : c));
      addToast('গ্রাহকের তথ্য আপডেট হয়েছে', 'ok');
    } else {
      const newC: Customer = { id: uid(), user_id: currentUser!.id, name: customerForm.name, phone: customerForm.phone, address: customerForm.address, email: customerForm.email, created_at: new Date().toISOString() };
      setCustomers(prev => [newC, ...prev]);
      addToast('নতুন গ্রাহক যোগ হয়েছে', 'ok');
    }
    setIsCustomerModalOpen(false);
  };
  const handleDeleteCustomer = (id: string) => {
    if (!confirm('এই গ্রাহক ও তার সব লেনদেন মুছে যাবে। নিশ্চিত?')) return;
    setCustomers(prev => prev.filter(c => c.id !== id));
    setTransactions(prev => prev.filter(t => t.customer_id !== id));
    if (selectedCustomerId === id) { setSelectedCustomerId(null); setActiveTab('customers'); }
    addToast('গ্রাহক মুছে ফেলা হয়েছে', 'ok');
  };

  // Transaction handlers
  const openTxModal = (type: 'credit' | 'payment') => {
    setTxForm({ type, amount: '', description: '', note: '', transaction_date: todayISO() });
    setIsTxModalOpen(true);
  };
  const handleSaveTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;
    const amt = Number(txForm.amount);
    if (!amt || amt <= 0) return addToast('সঠিক টাকার পরিমাণ দিন', 'er');
    if (!txForm.transaction_date) return addToast('তারিখ দিন', 'er');
    // Prevent over-payment? allow but warn
    if (txForm.type === 'payment') {
      const bal = getCustomerBalance(selectedCustomerId);
      if (amt > bal) addToast('সতর্কতা: জমার পরিমাণ বাকির চেয়ে বেশি', 'in');
    }
    const newTx: Transaction = {
      id: uid(),
      customer_id: selectedCustomerId,
      user_id: currentUser!.id,
      type: txForm.type,
      amount: amt,
      description: txForm.description || (txForm.type === 'credit' ? 'বাকি দেওয়া' : 'টাকা জমা'),
      note: txForm.note,
      transaction_date: txForm.transaction_date,
      created_at: new Date().toISOString()
    };
    setTransactions(prev => [...prev, newTx]);
    setIsTxModalOpen(false);
    addToast(txForm.type === 'credit' ? 'বাকি এন্ট্রি যোগ হয়েছে' : 'জমা এন্ট্রি যোগ হয়েছে', 'ok');
  };
  const handleDeleteTx = (id: string) => {
    if (!confirm('এই লেনদেন মুছবেন?')) return;
    setTransactions(prev => prev.filter(t => t.id !== id));
    addToast('লেনদেন মুছে ফেলা হয়েছে', 'ok');
  };

  // Computed
  const filteredCustomers = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  }, [customers, search]);

  const getCustomerBalance = (cid: string) => {
    const txs = transactions.filter(t => t.customer_id === cid);
    return txs.reduce((sum, t) => sum + (t.type === 'credit' ? t.amount : -t.amount), 0);
  };

  const getCustomerTxs = (cid: string) => {
    const txs = transactions.filter(t => t.customer_id === cid).sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    let bal = 0;
    return txs.map(t => {
      if (t.type === 'credit') bal += t.amount; else bal -= t.amount;
      return { ...t, balance: bal };
    });
  };

  const dashboard = useMemo(() => {
    const totalCustomers = customers.length;
    const totalDue = customers.reduce((sum, c) => sum + getCustomerBalance(c.id), 0);
    const today = todayISO();
    const todayCredit = transactions.filter(t => t.transaction_date === today && t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const todayPayment = transactions.filter(t => t.transaction_date === today && t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    // top debtors
    const balances = customers.map(c => ({ ...c, balance: getCustomerBalance(c.id) })).filter(c => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);
    // overdue
    const overdue = customers.map(c => {
      const txs = transactions.filter(t => t.customer_id === c.id && t.type === 'credit').sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
      const bal = getCustomerBalance(c.id);
      let isOverdue = false;
      if (bal > 0 && txs.length > 0) {
        const oldest = txs[0].transaction_date;
        if (differenceInDays(new Date(), parseISO(oldest)) > 30) isOverdue = true;
      }
      return { ...c, balance: bal, isOverdue, oldest: txs[0]?.transaction_date || null };
    }).filter(c => c.isOverdue).sort((a, b) => b.balance - a.balance);

    // last 7 days
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      const iso = format(d, 'yyyy-MM-dd');
      const dayTxs = transactions.filter(t => t.transaction_date === iso);
      last7.push({
        date: format(d, 'dd MMM'),
        credit: dayTxs.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
        payment: dayTxs.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0)
      });
    }
    return { totalCustomers, totalDue, todayCredit, todayPayment, topDebtors: balances, overdue, last7 };
  }, [customers, transactions]);

  const reports = useMemo(() => {
    let filtered = [...transactions];
    const now = new Date();
    if (reportPeriod === 'daily') {
      const today = todayISO();
      filtered = filtered.filter(t => t.transaction_date === today);
    } else if (reportPeriod === 'weekly') {
      const start = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
      const end = endOfWeek(now, { weekStartsOn: 6 });
      filtered = filtered.filter(t => {
        const d = parseISO(t.transaction_date);
        return isWithinInterval(d, { start, end });
      });
    } else if (reportPeriod === 'monthly') {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      filtered = filtered.filter(t => {
        const d = parseISO(t.transaction_date);
        return isWithinInterval(d, { start, end });
      });
    }
    const totalCredit = filtered.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalPayment = filtered.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0);
    return { filtered, totalCredit, totalPayment, count: filtered.length };
  }, [transactions, reportPeriod]);

  // PDF download
  const downloadLedgerPDF = async () => {
    if (!selectedCustomerId) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;
    const history = getCustomerTxs(selectedCustomerId);
    const bal = getCustomerBalance(selectedCustomerId);
    try {
      const { jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF();
      // Header
      doc.setFillColor(14, 165, 233);
      doc.rect(0, 0, 210, 32, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('স্মার্ট বাকি খাতা', 14, 14);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`${currentUser?.name} | ${currentUser?.email}`, 14, 22);
      doc.text(`তারিখ: ${format(new Date(), 'dd MMM yyyy, hh:mm a')}`, 14, 27);
      // Customer info
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`গ্রাহক: ${customer.name}`, 14, 42);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`মোবাইল: ${customer.phone}  |  ঠিকানা: ${customer.address || '—'}`, 14, 48);
      doc.text(`মোট বাকি: ৳ ${bal.toLocaleString('bn-BD')}  |  মোট লেনদেন: ${history.length} টি`, 14, 53);
      // Table
      const body = history.map((t, i) => [
        i + 1,
        fmtDate(t.transaction_date),
        t.description,
        t.type === 'credit' ? 'বাকি' : 'জমা',
        `৳ ${t.amount.toLocaleString('bn-BD')}`,
        `৳ ${t.balance.toLocaleString('bn-BD')}`,
        t.note || '—'
      ]);
      autoTable(doc, {
        head: [['ক্রঃ', 'তারিখ', 'বিবরণ', 'ধরন', 'টাকা', 'ব্যালেন্স', 'নোট']],
        body,
        startY: 60,
        theme: 'grid',
        headStyles: { fillColor: [14, 165, 233], textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 1: { cellWidth: 28 }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'right' } }
      });
      const finalY = (doc as any).lastAutoTable?.finalY || 60;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('এই রিপোর্টটি স্মার্ট বাকি খাতা থেকে স্বয়ংক্রিয়ভাবে তৈরি।', 14, finalY + 10);
      doc.save(`Ledger_${customer.name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      addToast('PDF ডাউনলোড হয়েছে', 'ok');
    } catch (e) {
      console.error(e);
      addToast('PDF তৈরি করতে সমস্যা', 'er');
    }
  };

  const shareWhatsApp = () => {
    if (!selectedCustomerId) return;
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) return;
    const bal = getCustomerBalance(selectedCustomerId);
    const history = getCustomerTxs(selectedCustomerId).slice(-5);
    let msg = `*স্মার্ট বাকি খাতা*%0A`;
    msg += `গ্রাহক: ${customer.name}%0A`;
    msg += `মোবাইল: ${customer.phone}%0A`;
    msg += `মোট বাকি: ৳ ${bal.toLocaleString('bn-BD')}%0A%0A`;
    msg += `শেষ ৫ লেনদেন:%0A`;
    history.forEach(t => {
      msg += `• ${fmtDate(t.transaction_date)} - ${t.type === 'credit' ? 'বাকি' : 'জমা'} ৳${t.amount} (${t.description})%0A`;
    });
    msg += `%0Aঅনুগ্রহ করে বাকি পরিশোধ করুন। ধন্যবাদ!`;
    const phone = customer.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/88${phone}?text=${msg}`;
    window.open(url, '_blank');
  };

  const captureScreenshot = async () => {
    if (!ledgerRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ledgerRef.current, { scale: 2, backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff' });
      const link = document.createElement('a');
      link.download = `ledger_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      addToast('স্ক্রিনশট ডাউনলোড হয়েছে', 'ok');
    } catch {
      addToast('স্ক্রিনশট নিতে সমস্যা', 'er');
    }
  };

  const handleBackup = () => {
    const data = { user: currentUser, customers, transactions, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${currentUser?.name}_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('ব্যাকআপ ডাউনলোড হয়েছে', 'ok');
  };
  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.customers && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          addToast(`${data.customers.length} গ্রাহক রিস্টোর হয়েছে`, 'ok');
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          setTransactions(data.transactions);
        }
      } catch {
        addToast('ফাইলটি সঠিক নয়', 'er');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered ledger history for selected customer with running balance already sorted
  const selectedCustomer = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId) || null : null;
  const selectedHistory = selectedCustomerId ? getCustomerTxs(selectedCustomerId) : [];
  const selectedBalance = selectedCustomerId ? getCustomerBalance(selectedCustomerId) : 0;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 bg-card rounded-3xl shadow-2xl overflow-hidden relative">
          {/* Left branding */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/20 rounded-full blur-3xl" />
            <div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 rounded-2xl bg-sky-500 flex items-center justify-center shadow-lg">
                  <Store size={24} className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-black">স্মার্ট বাকি খাতা</h1>
                  <p className="text-xs text-white/60">Smart Credit Ledger</p>
                </div>
              </div>
              <h2 className="text-3xl font-black leading-tight mb-4">দোকানের ডিজিটাল<br />বাকি খাতা</h2>
              <p className="text-white/70 text-sm leading-relaxed mb-6">গ্রাহক, বাকি, জমা – সব হিসাব এক জায়গায়। মোবাইলেই চলবে, অফলাইনেও কাজ করবে।</p>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Users size={14} /></div> গ্রাহক ম্যানেজমেন্ট</div>
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Wallet size={14} /></div> বাকি ও জমার অটো ব্যালেন্স</div>
                <div className="flex items-center gap-3"><div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><BarChart3 size={14} /></div> ড্যাশবোর্ড ও রিপোর্ট</div>
              </div>
            </div>
            <div className="mt-8 text-xs text-white/40">© ২০২৬ স্মার্ট বাকি খাতা • নিরাপদ ও সহজ</div>
          </div>

          {/* Right auth */}
          <div className="p-8 md:p-10 bg-card">
            <div className="flex gap-2 mb-8 p-1 bg-bg2 rounded-2xl w-fit">
              <button onClick={() => setAuthMode('login')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition", authMode === 'login' ? "bg-card shadow text-fg" : "text-muted")}>লগইন</button>
              <button onClick={() => setAuthMode('register')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition", authMode === 'register' ? "bg-card shadow text-fg" : "text-muted")}>রেজিস্টার</button>
            </div>

            <h3 className="text-2xl font-black mb-2">{authMode === 'login' ? 'স্বাগতম!' : 'নতুন অ্যাকাউন্ট'}</h3>
            <p className="text-sm text-muted mb-6">{authMode === 'login' ? 'আপনার দোকানের খাতায় প্রবেশ করুন' : 'বিনামূল্যে অ্যাকাউন্ট তৈরি করুন'}</p>

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="text-xs font-bold text-muted uppercase tracking-wider">দোকান / আপনার নাম</label>
                  <div className="relative mt-1.5">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                    <input className="fi pl-10" placeholder="যেমন: করিম স্টোর" value={authForm.name} onChange={e => setAuthForm({ ...authForm, name: e.target.value })} />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider">ইমেইল</label>
                <div className="relative mt-1.5">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="fi pl-10" type="email" placeholder="example@gmail.com" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase tracking-wider">পাসওয়ার্ড</label>
                <div className="relative mt-1.5">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="fi pl-10" type="password" placeholder="কমপক্ষে ৬ অক্ষর" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-p w-full py-3.5 text-base mt-2">
                {authMode === 'login' ? 'প্রবেশ করুন' : 'অ্যাকাউন্ট তৈরি করুন'} <ChevronRight size={18} />
              </button>
            </form>

            <div className="mt-6 p-3 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-700">
              <b>ডেমো:</b> যেকোনো ইমেইল/পাসওয়ার্ড দিয়ে রেজিস্টার করুন, সাথে সাথে ডেমো ডেটা পাবেন।
            </div>
          </div>
        </div>

        {/* Toast */}
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(t => (
            <div key={t.id} className={cn("px-4 py-3 rounded-xl shadow-xl text-sm font-bold border backdrop-blur", t.type === 'ok' ? "bg-emerald-500 text-white border-emerald-600" : t.type === 'er' ? "bg-rose-500 text-white border-rose-600" : "bg-sky-500 text-white border-sky-600")}>{t.msg}</div>
          ))}
        </div>
      </div>
    );
  }

  // Main app
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-3 md:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden p-2 rounded-xl bg-bg2"><Menu size={18} /></button>
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white"><Store size={18} /></div>
            <div className="hidden sm:block">
              <h1 className="font-black leading-none">স্মার্ট বাকি খাতা</h1>
              <p className="text-[11px] text-muted -mt-0.5">{currentUser.name} • {currentUser.email}</p>
            </div>
            <div className="sm:hidden font-black text-sm">বাকি খাতা</div>
          </div>

          <nav className="hidden md:flex items-center gap-1.5 p-1 bg-bg2 rounded-2xl">
            <button onClick={() => setActiveTab('dashboard')} className={cn("px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition", activeTab === 'dashboard' ? "bg-card shadow text-sky-600" : "text-muted hover:text-fg")}><LayoutDashboard size={16} /> ড্যাশবোর্ড</button>
            <button onClick={() => setActiveTab('customers')} className={cn("px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition", activeTab === 'customers' || activeTab === 'ledger' ? "bg-card shadow text-sky-600" : "text-muted hover:text-fg")}><Users size={16} /> গ্রাহক</button>
            <button onClick={() => setActiveTab('reports')} className={cn("px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition", activeTab === 'reports' ? "bg-card shadow text-sky-600" : "text-muted hover:text-fg")}><FileText size={16} /> রিপোর্ট</button>
            <button onClick={() => setActiveTab('profile')} className={cn("px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition", activeTab === 'profile' ? "bg-card shadow text-sky-600" : "text-muted hover:text-fg")}><Settings size={16} /> প্রোফাইল</button>
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-9 h-9 rounded-xl bg-bg2 flex items-center justify-center hover:bg-card border border-border">{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button onClick={handleBackup} className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-bg2 border border-border text-xs font-bold"><Download size={14} /> ব্যাকআপ</button>
            <label className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-bg2 border border-border text-xs font-bold cursor-pointer"><Upload size={14} /> রিস্টোর<input type="file" accept=".json" className="hidden" onChange={handleRestore} /></label>
            <button onClick={handleLogout} className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100"><LogOut size={16} /></button>
          </div>
        </div>
        {/* mobile nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card p-3 grid grid-cols-2 gap-2">
            <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={cn("p-3 rounded-xl font-bold flex items-center gap-2", activeTab === 'dashboard' ? "bg-sky-600 text-white" : "bg-bg2")}><LayoutDashboard size={16} /> ড্যাশবোর্ড</button>
            <button onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }} className={cn("p-3 rounded-xl font-bold flex items-center gap-2", activeTab === 'customers' ? "bg-sky-600 text-white" : "bg-bg2")}><Users size={16} /> গ্রাহক</button>
            <button onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} className={cn("p-3 rounded-xl font-bold flex items-center gap-2", activeTab === 'reports' ? "bg-sky-600 text-white" : "bg-bg2")}><FileText size={16} /> রিপোর্ট</button>
            <button onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }} className={cn("p-3 rounded-xl font-bold flex items-center gap-2", activeTab === 'profile' ? "bg-sky-600 text-white" : "bg-bg2")}><Settings size={16} /> প্রোফাইল</button>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-3 md:px-6 py-4 md:py-6">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <div className="glass-card p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center"><Users size={18} /></div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-sky-50 text-sky-700">মোট</span>
                </div>
                <div className="text-2xl md:text-3xl font-black">{dashboard.totalCustomers}</div>
                <div className="text-xs text-muted font-bold uppercase tracking-wider">মোট গ্রাহক</div>
              </div>
              <div className="glass-card p-4 md:p-5 border-sky-200/50">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center"><Wallet size={18} /></div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700">বাকি</span>
                </div>
                <div className="text-2xl md:text-3xl font-black">{fmtMoney(dashboard.totalDue)}</div>
                <div className="text-xs text-muted font-bold uppercase tracking-wider">মোট বাকি</div>
              </div>
              <div className="glass-card p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center"><Banknote size={18} /></div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">আজ</span>
                </div>
                <div className="text-2xl md:text-3xl font-black text-emerald-600">{fmtMoney(dashboard.todayPayment)}</div>
                <div className="text-xs text-muted font-bold uppercase tracking-wider">আজ জমা</div>
              </div>
              <div className="glass-card p-4 md:p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center"><CreditCard size={18} /></div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full bg-rose-50 text-rose-700">আজ</span>
                </div>
                <div className="text-2xl md:text-3xl font-black text-rose-600">{fmtMoney(dashboard.todayCredit)}</div>
                <div className="text-xs text-muted font-bold uppercase tracking-wider">আজ বাকি</div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
              <div className="lg:col-span-2 glass-card p-4 md:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black flex items-center gap-2"><BarChart3 size={18} className="text-sky-600" /> শেষ ৭ দিনের লেনদেন</h3>
                  <span className="text-xs text-muted">বাকি বনাম জমা</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dashboard.last7}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                      <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid var(--border)' }} />
                      <Bar dataKey="credit" name="বাকি" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="payment" name="জমা" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-card p-4 md:p-6">
                <h3 className="font-black flex items-center gap-2 mb-4"><PieIcon size={18} className="text-sky-600" /> বাকি বিতরণ</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[
                        { name: 'মোট বাকি', value: dashboard.totalDue },
                        { name: 'পরিশোধ', value: Math.max(0, transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0) - dashboard.totalDue) }
                      ]} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={4}>
                        <Cell fill="#f59e0b" />
                        <Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-100"><div className="font-black text-amber-700">{fmtMoney(dashboard.totalDue)}</div><div className="text-muted">বাকি</div></div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100"><div className="font-black text-emerald-700">{fmtMoney(transactions.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0))}</div><div className="text-muted">মোট জমা</div></div>
                </div>
              </div>
            </div>

            {/* Top debtors & overdue */}
            <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
              <div className="glass-card p-4 md:p-6">
                <h3 className="font-black flex items-center gap-2 mb-4"><TrendingUp size={18} className="text-amber-600" /> সবচেয়ে বেশি বাকি</h3>
                {dashboard.topDebtors.length === 0 ? <div className="text-center py-8 text-muted text-sm">কোনো বাকি নেই</div> :
                  <div className="space-y-3">
                    {dashboard.topDebtors.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-bg2 border border-border">
                        <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black">#{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{c.name}</div>
                          <div className="text-xs text-muted flex items-center gap-1"><Phone size={10} /> {c.phone}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-600">{fmtMoney(c.balance)}</div>
                          <button onClick={() => { setSelectedCustomerId(c.id); setActiveTab('ledger'); }} className="text-xs text-sky-600 font-bold">দেখুন →</button>
                        </div>
                      </div>
                    ))}
                  </div>
                }
              </div>
              <div className="glass-card p-4 md:p-6 border-rose-200/50">
                <h3 className="font-black flex items-center gap-2 mb-4"><AlertTriangle size={18} className="text-rose-600" /> ৩০ দিনের বেশি পুরনো বাকি</h3>
                {dashboard.overdue.length === 0 ? <div className="text-center py-8 text-emerald-600 bg-emerald-50 rounded-xl border border-emerald-100 font-bold">🎉 কোনো মেয়াদোত্তীর্ণ বাকি নেই!</div> :
                  <div className="space-y-3">
                    {dashboard.overdue.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                        <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center"><AlertTriangle size={16} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold truncate">{c.name}</div>
                          <div className="text-xs text-muted">{c.oldest ? `${differenceInDays(new Date(), parseISO(c.oldest))} দিন আগে` : ''} • {c.phone}</div>
                        </div>
                        <div className="font-black text-rose-600">{fmtMoney(c.balance)}</div>
                      </div>
                    ))}
                  </div>
                }
              </div>
            </div>

            {/* Recent tx */}
            <div className="glass-card p-4 md:p-6">
              <h3 className="font-black flex items-center gap-2 mb-4"><History size={18} className="text-sky-600" /> সাম্প্রতিক লেনদেন</h3>
              <div className="overflow-x-auto">
                <table className="et">
                  <thead><tr><th>তারিখ</th><th>গ্রাহক</th><th>ধরন</th><th>বিবরণ</th><th>টাকা</th></tr></thead>
                  <tbody>
                    {transactions.slice(0, 8).map(t => {
                      const cust = customers.find(c => c.id === t.customer_id);
                      return (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                          <td className="font-bold">{cust?.name || '—'}</td>
                          <td><span className={cn("px-2 py-1 rounded-full text-xs font-bold", t.type === 'credit' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{t.type === 'credit' ? 'বাকি' : 'জমা'}</span></td>
                          <td className="max-w-[200px] truncate">{t.description}</td>
                          <td className="font-black">{fmtMoney(t.amount)}</td>
                        </tr>
                      );
                    })}
                    {transactions.length === 0 && <tr><td colSpan={5} className="py-8 text-muted">কোনো লেনদেন নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Customers */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">গ্রাহক তালিকা</h2>
                <p className="text-sm text-muted">{customers.length} জন গ্রাহক • মোট বাকি {fmtMoney(customers.reduce((s, c) => s + getCustomerBalance(c.id), 0))}</p>
              </div>
              <button onClick={openAddCustomer} className="btn btn-p"><Plus size={18} /> নতুন গ্রাহক</button>
            </div>

            <div className="glass-card p-3 flex items-center gap-3">
              <Search size={18} className="text-muted ml-2" />
              <input className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted" placeholder="নাম বা মোবাইল দিয়ে খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="p-1.5 rounded-lg bg-bg2"><X size={14} /></button>}
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filteredCustomers.map(c => {
                const bal = getCustomerBalance(c.id);
                const txCount = transactions.filter(t => t.customer_id === c.id).length;
                return (
                  <div key={c.id} className="glass-card p-4 flex flex-col">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-sm">{c.name.charAt(0)}</div>
                        <div>
                          <div className="font-black leading-none">{c.name}</div>
                          <div className="text-xs text-muted flex items-center gap-1 mt-1"><Phone size={11} /> {c.phone}</div>
                        </div>
                      </div>
                      <div className={cn("px-2.5 py-1 rounded-full text-xs font-black", bal > 0 ? "bg-amber-100 text-amber-700" : bal < 0 ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700")}>
                        {bal > 0 ? 'বাকি' : bal < 0 ? 'অগ্রিম' : 'পরিশোধ'}
                      </div>
                    </div>
                    {c.address && <div className="text-xs text-muted flex items-center gap-1 mb-2"><MapPin size={11} /> {c.address}</div>}
                    {c.email && <div className="text-xs text-muted flex items-center gap-1 mb-3"><Mail size={11} /> {c.email}</div>}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="p-2.5 rounded-xl bg-bg2 text-center">
                        <div className="text-[11px] font-bold text-muted uppercase">বাকি</div>
                        <div className={cn("font-black", bal > 0 ? "text-amber-600" : "text-emerald-600")}>{fmtMoney(bal)}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-bg2 text-center">
                        <div className="text-[11px] font-bold text-muted uppercase">লেনদেন</div>
                        <div className="font-black">{txCount} টি</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-auto">
                      <button onClick={() => { setSelectedCustomerId(c.id); setActiveTab('ledger'); }} className="flex-1 btn btn-p py-2.5 text-xs"><Eye size={14} /> খাতা দেখুন</button>
                      <button onClick={() => openEditCustomer(c)} className="w-10 h-10 rounded-xl bg-bg2 border border-border flex items-center justify-center hover:bg-card"><Edit2 size={14} /></button>
                      <button onClick={() => handleDeleteCustomer(c.id)} className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center hover:bg-rose-100"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredCustomers.length === 0 && (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg2 mx-auto flex items-center justify-center mb-4"><Users size={24} className="text-muted" /></div>
                <div className="font-bold">কোনো গ্রাহক পাওয়া যায়নি</div>
                <div className="text-sm text-muted mt-1">নতুন গ্রাহক যোগ করুন বা অন্য নাম দিয়ে খুঁজুন</div>
              </div>
            )}
          </div>
        )}

        {/* Ledger */}
        {activeTab === 'ledger' && selectedCustomer && (
          <div className="space-y-4">
            <button onClick={() => setActiveTab('customers')} className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-fg"><ArrowLeft size={16} /> গ্রাহক তালিকায় ফিরুন</button>

            <div ref={ledgerRef} className="glass-card overflow-hidden">
              {/* ledger header */}
              <div className="bg-gradient-to-r from-sky-600 to-indigo-600 text-white p-4 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white text-sky-600 flex items-center justify-center font-black text-xl">{selectedCustomer.name.charAt(0)}</div>
                    <div>
                      <h2 className="text-xl md:text-2xl font-black">{selectedCustomer.name}</h2>
                      <div className="flex flex-wrap gap-3 text-sm text-white/80 mt-1">
                        <span className="flex items-center gap-1"><Phone size={14} /> {selectedCustomer.phone}</span>
                        {selectedCustomer.address && <span className="flex items-center gap-1"><MapPin size={14} /> {selectedCustomer.address}</span>}
                        {selectedCustomer.email && <span className="flex items-center gap-1"><Mail size={14} /> {selectedCustomer.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white text-slate-900 rounded-2xl p-4 min-w-[160px] text-center">
                    <div className="text-xs font-bold text-muted uppercase tracking-wider">বর্তমান ব্যালেন্স</div>
                    <div className={cn("text-2xl font-black", selectedBalance > 0 ? "text-amber-600" : selectedBalance < 0 ? "text-sky-600" : "text-emerald-600")}>{fmtMoney(selectedBalance)}</div>
                    <div className="text-xs font-bold mt-1 px-2 py-1 rounded-full inline-block" style={{ background: selectedBalance > 0 ? '#fef3c7' : selectedBalance < 0 ? '#e0f2fe' : '#dcfce7', color: selectedBalance > 0 ? '#b45309' : selectedBalance < 0 ? '#0369a1' : '#15803d' }}>
                      {selectedBalance > 0 ? `বাকি আছে` : selectedBalance < 0 ? `অগ্রিম আছে` : `পরিশোধিত`}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-6">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <div className="text-xs opacity-80">মোট বাকি</div>
                    <div className="font-black">{fmtMoney(selectedHistory.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0))}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <div className="text-xs opacity-80">মোট জমা</div>
                    <div className="font-black">{fmtMoney(selectedHistory.filter(t => t.type === 'payment').reduce((s, t) => s + t.amount, 0))}</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-3 text-center">
                    <div className="text-xs opacity-80">লেনদেন</div>
                    <div className="font-black">{selectedHistory.length} টি</div>
                  </div>
                </div>
              </div>

              {/* actions */}
              <div className="p-3 md:p-4 bg-bg2 border-y border-border flex flex-wrap gap-2">
                <button onClick={() => openTxModal('credit')} className="btn bg-amber-500 text-white hover:bg-amber-600"><Plus size={16} /> বাকি যোগ</button>
                <button onClick={() => openTxModal('payment')} className="btn bg-emerald-600 text-white hover:bg-emerald-700"><Banknote size={16} /> টাকা জমা</button>
                <div className="flex-1" />
                <button onClick={downloadLedgerPDF} className="btn btn-s text-xs"><Download size={14} /> PDF</button>
                <button onClick={shareWhatsApp} className="btn bg-green-500 text-white hover:bg-green-600 text-xs"><MessageCircle size={14} /> WhatsApp</button>
                <button onClick={captureScreenshot} className="btn btn-s text-xs"><Camera size={14} /> ছবি</button>
              </div>

              {/* history */}
              <div className="p-3 md:p-4">
                <h3 className="font-black flex items-center gap-2 mb-3"><History size={16} className="text-sky-600" /> লেনদেনের ইতিহাস</h3>
                <div className="overflow-x-auto">
                  <table className="et">
                    <thead>
                      <tr>
                        <th>তারিখ</th>
                        <th>বিবরণ</th>
                        <th>ধরন</th>
                        <th>টাকা</th>
                        <th>ব্যালেন্স</th>
                        <th>নোট</th>
                        <th className="no-print">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selectedHistory].reverse().map(t => (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap text-xs">{fmtDate(t.transaction_date)}</td>
                          <td className="text-left max-w-[180px] truncate font-medium">{t.description}</td>
                          <td><span className={cn("px-2 py-1 rounded-full text-xs font-bold", t.type === 'credit' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{t.type === 'credit' ? 'বাকি' : 'জমা'}</span></td>
                          <td className={cn("font-black whitespace-nowrap", t.type === 'credit' ? "text-amber-600" : "text-emerald-600")}>{t.type === 'credit' ? '+' : '-'} {fmtMoney(t.amount)}</td>
                          <td className="font-bold whitespace-nowrap">{fmtMoney(t.balance)}</td>
                          <td className="max-w-[120px] truncate text-xs text-muted">{t.note || '—'}</td>
                          <td className="no-print"><button onClick={() => handleDeleteTx(t.id)} className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mx-auto"><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                      {selectedHistory.length === 0 && <tr><td colSpan={7} className="py-10 text-muted">কোনো লেনদেন নেই। নতুন বাকি বা জমা যোগ করুন।</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">রিপোর্ট</h2>
                <p className="text-sm text-muted">দৈনিক / সাপ্তাহিক / মাসিক লেনদেনের সারাংশ</p>
              </div>
              <div className="flex gap-2 p-1 bg-bg2 rounded-xl w-fit">
                <button onClick={() => setReportPeriod('daily')} className={cn("px-4 py-2 rounded-xl text-sm font-bold", reportPeriod === 'daily' ? "bg-card shadow text-sky-600" : "text-muted")}>দৈনিক</button>
                <button onClick={() => setReportPeriod('weekly')} className={cn("px-4 py-2 rounded-xl text-sm font-bold", reportPeriod === 'weekly' ? "bg-card shadow text-sky-600" : "text-muted")}>সাপ্তাহিক</button>
                <button onClick={() => setReportPeriod('monthly')} className={cn("px-4 py-2 rounded-xl text-sm font-bold", reportPeriod === 'monthly' ? "bg-card shadow text-sky-600" : "text-muted")}>মাসিক</button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="glass-card p-4 text-center">
                <div className="text-xs font-bold text-muted uppercase">মোট লেনদেন</div>
                <div className="text-2xl font-black">{reports.count} টি</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs font-bold text-muted uppercase">মোট বাকি</div>
                <div className="text-2xl font-black text-amber-600">{fmtMoney(reports.totalCredit)}</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs font-bold text-muted uppercase">মোট জমা</div>
                <div className="text-2xl font-black text-emerald-600">{fmtMoney(reports.totalPayment)}</div>
              </div>
              <div className="glass-card p-4 text-center">
                <div className="text-xs font-bold text-muted uppercase">নিট</div>
                <div className={cn("text-2xl font-black", reports.totalCredit - reports.totalPayment >= 0 ? "text-amber-600" : "text-emerald-600")}>{fmtMoney(reports.totalCredit - reports.totalPayment)}</div>
              </div>
            </div>

            <div className="glass-card p-4 md:p-6">
              <h3 className="font-black mb-4 flex items-center gap-2"><Calendar size={16} className="text-sky-600" /> {reportPeriod === 'daily' ? 'আজকের' : reportPeriod === 'weekly' ? 'এই সপ্তাহের' : 'এই মাসের'} লেনদেন</h3>
              <div className="overflow-x-auto">
                <table className="et">
                  <thead><tr><th>তারিখ</th><th>গ্রাহক</th><th>ধরন</th><th>বিবরণ</th><th>টাকা</th><th>নোট</th></tr></thead>
                  <tbody>
                    {reports.filtered.map(t => {
                      const c = customers.find(x => x.id === t.customer_id);
                      return (
                        <tr key={t.id}>
                          <td>{fmtDate(t.transaction_date)}</td>
                          <td className="font-bold">{c?.name || '—'}</td>
                          <td><span className={cn("px-2 py-1 rounded-full text-xs font-bold", t.type === 'credit' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{t.type === 'credit' ? 'বাকি' : 'জমা'}</span></td>
                          <td>{t.description}</td>
                          <td className="font-black">{fmtMoney(t.amount)}</td>
                          <td className="text-xs text-muted max-w-[150px] truncate">{t.note || '—'}</td>
                        </tr>
                      );
                    })}
                    {reports.filtered.length === 0 && <tr><td colSpan={6} className="py-10 text-muted">কোনো লেনদেন নেই</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* customer ledger sharing */}
            <div className="glass-card p-4 md:p-6">
              <h3 className="font-black mb-4 flex items-center gap-2"><Share2 size={16} className="text-sky-600" /> গ্রাহক ভিত্তিক শেয়ার</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {customers.map(c => {
                  const bal = getCustomerBalance(c.id);
                  return (
                    <div key={c.id} className="p-3 rounded-xl bg-bg2 border border-border flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm">{c.name}</div>
                        <div className="text-xs text-muted">{c.phone} • {fmtMoney(bal)}</div>
                      </div>
                      <button onClick={() => { setSelectedCustomerId(c.id); setActiveTab('ledger'); setTimeout(() => window.scrollTo(0, 0), 50); }} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center"><Eye size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Profile */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="glass-card p-6 md:p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-sky-600 text-white flex items-center justify-center font-black text-2xl mx-auto">{currentUser.name.charAt(0)}</div>
              <h2 className="text-2xl font-black mt-4">{currentUser.name}</h2>
              <p className="text-sm text-muted">{currentUser.email}</p>
              <p className="text-xs text-muted mt-1">অ্যাকাউন্ট তৈরি: {fmtDateTime(currentUser.created_at)}</p>
            </div>

            <div className="glass-card p-6">
              <h3 className="font-black flex items-center gap-2 mb-4"><User size={16} className="text-sky-600" /> প্রোফাইল আপডেট</h3>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-muted uppercase">নাম</label>
                  <input className="fi mt-1.5" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="আপনার নাম" />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted uppercase">ইমেইল</label>
                  <input className="fi mt-1.5" type="email" value={profileForm.email} onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} placeholder="ইমেইল" />
                </div>
                <button type="submit" className="btn btn-p w-full"><Save size={16} /> আপডেট করুন</button>
              </form>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card p-6">
                <h3 className="font-black flex items-center gap-2 mb-3"><Database size={16} className="text-sky-600" /> ডেটা ব্যবস্থাপনা</h3>
                <div className="space-y-2">
                  <button onClick={handleBackup} className="btn btn-s w-full justify-start"><Download size={16} /> ব্যাকআপ ডাউনলোড (JSON)</button>
                  <label className="btn btn-s w-full justify-start cursor-pointer"><Upload size={16} /> ব্যাকআপ রিস্টোর<input type="file" accept=".json" className="hidden" onChange={handleRestore} /></label>
                </div>
                <p className="text-xs text-muted mt-3">ব্যাকআপে সব গ্রাহক ও লেনদেন থাকবে। নিয়মিত ব্যাকআপ রাখুন।</p>
              </div>
              <div className="glass-card p-6">
                <h3 className="font-black flex items-center gap-2 mb-3"><Store size={16} className="text-sky-600" /> পরিসংখ্যান</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted">মোট গ্রাহক</span><span className="font-black">{customers.length} জন</span></div>
                  <div className="flex justify-between"><span className="text-muted">মোট লেনদেন</span><span className="font-black">{transactions.length} টি</span></div>
                  <div className="flex justify-between"><span className="text-muted">মোট বাকি</span><span className="font-black text-amber-600">{fmtMoney(customers.reduce((s, c) => s + getCustomerBalance(c.id), 0))}</span></div>
                </div>
                <button onClick={() => { if (confirm('সব ডেটা মুছে যাবে! নিশ্চিত?')) { setCustomers([]); setTransactions([]); addToast('সব ডেটা মুছে ফেলা হয়েছে', 'ok'); } }} className="btn bg-rose-50 text-rose-600 hover:bg-rose-100 w-full mt-4 text-xs"><Trash2 size={14} /> সব ডেটা মুছুন</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Customer modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsCustomerModalOpen(false)} />
          <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-card p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-black">{editingCustomer ? 'গ্রাহক এডিট' : 'নতুন গ্রাহক যোগ'}</h3>
              <button onClick={() => setIsCustomerModalOpen(false)} className="w-9 h-9 rounded-xl bg-bg2 flex items-center justify-center"><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted uppercase">নাম *</label>
                <input className="fi mt-1.5" placeholder="যেমন: করিম স্টোর" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">মোবাইল *</label>
                <input className="fi mt-1.5" placeholder="017XXXXXXXX" value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">ঠিকানা</label>
                <input className="fi mt-1.5" placeholder="ঠিকানা লিখুন (ঐচ্ছিক)" value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">ইমেইল (ঐচ্ছিক)</label>
                <input className="fi mt-1.5" type="email" placeholder="example@gmail.com" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="flex-1 btn btn-s">বাতিল</button>
                <button type="submit" className="flex-1 btn btn-p"><Save size={16} /> {editingCustomer ? 'আপডেট' : 'যোগ করুন'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction modal */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsTxModalOpen(false)} />
          <div className="relative bg-card rounded-3xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xl font-black flex items-center gap-2">
                {txForm.type === 'credit' ? <><CreditCard size={18} className="text-amber-600" /> বাকি দেওয়া</> : <><Banknote size={18} className="text-emerald-600" /> টাকা জমা</>}
              </h3>
              <button onClick={() => setIsTxModalOpen(false)} className="w-9 h-9 rounded-xl bg-bg2 flex items-center justify-center"><X size={16} /></button>
            </div>
            <form onSubmit={handleSaveTx} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 bg-bg2 rounded-xl">
                <button type="button" onClick={() => setTxForm({ ...txForm, type: 'credit' })} className={cn("py-2.5 rounded-xl font-bold text-sm", txForm.type === 'credit' ? "bg-amber-500 text-white shadow" : "text-muted")}>বাকি</button>
                <button type="button" onClick={() => setTxForm({ ...txForm, type: 'payment' })} className={cn("py-2.5 rounded-xl font-bold text-sm", txForm.type === 'payment' ? "bg-emerald-600 text-white shadow" : "text-muted")}>জমা</button>
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">তারিখ *</label>
                <input type="date" className="fi mt-1.5" value={txForm.transaction_date} onChange={e => setTxForm({ ...txForm, transaction_date: e.target.value })} required />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">টাকার পরিমাণ *</label>
                <input type="number" className="fi mt-1.5" placeholder="০.০০" value={txForm.amount} onChange={e => setTxForm({ ...txForm, amount: e.target.value })} required min={1} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">বিবরণ {txForm.type === 'credit' ? '(কী পণ্য নিল)' : ''}</label>
                <input className="fi mt-1.5" placeholder={txForm.type === 'credit' ? 'যেমন: শার্ট ১০ পিস, থান কাপড়' : 'যেমন: নগদ জমা'} value={txForm.description} onChange={e => setTxForm({ ...txForm, description: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-muted uppercase">নোট / কমেন্ট (ঐচ্ছিক)</label>
                <textarea className="fi mt-1.5 min-h-[70px] resize-none" placeholder="অতিরিক্ত তথ্য লিখুন..." value={txForm.note} onChange={e => setTxForm({ ...txForm, note: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsTxModalOpen(false)} className="flex-1 btn btn-s">বাতিল</button>
                <button type="submit" className={cn("flex-1 btn text-white", txForm.type === 'credit' ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700")}><Save size={16} /> সংরক্ষণ করুন</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 left-4 md:left-auto z-50 flex flex-col gap-2 md:w-96">
        {toasts.map(t => (
          <div key={t.id} className={cn("px-4 py-3 rounded-2xl shadow-xl text-sm font-bold flex items-center gap-3 border animate-in slide-in-from-bottom-2", t.type === 'ok' ? "bg-emerald-500 text-white border-emerald-600" : t.type === 'er' ? "bg-rose-500 text-white border-rose-600" : "bg-sky-500 text-white border-sky-600")}>
            {t.type === 'ok' ? <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">✓</div> : t.type === 'er' ? <AlertTriangle size={16} /> : <span>ℹ</span>}
            <span className="flex-1">{t.msg}</span>
          </div>
        ))}
      </div>

      <footer className="border-t border-border bg-card/50 py-4 text-center text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© ২০২৬ স্মার্ট বাকি খাতা • দোকানের ডিজিটাল খাতা • নিরাপদ ও অফলাইন</span>
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> সিস্টেম চালু আছে</span>
        </div>
      </footer>
    </div>
  );
}
