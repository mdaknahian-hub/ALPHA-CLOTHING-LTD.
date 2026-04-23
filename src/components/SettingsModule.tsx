import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Users, 
  Shield, 
  Clock, 
  Activity, 
  Palette, 
  Type as FontTypeIcon, 
  Maximize, 
  Info, 
  LogOut, 
  Layout as LayoutPanelIcon, 
  Lock as LockIcon,
  CheckCircle2, 
  UserX, 
  UserCheck, 
  Trash2, 
  ChevronRight,
  ShieldCheck,
  Zap,
  Monitor as MonitorIcon, 
  Columns2,
  Compass,
  Contrast,
  Grid3X3,
  MousePointer2,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AppUser, UserRole, UserStatus } from '../types';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import AboutSection from './AboutSection';
import SystemHealth from './SystemHealth';

interface SettingsProps {
  orders: any[];
  entries: any[];
  userProfile: any;
  currentTheme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  appSettings: any;
  updateAppSettings: (s: any) => void;
  onLogout: () => Promise<void>;
}

const FONT_FAMILIES = [
  { id: 'sans', label: 'Inter (Sans-serif)', value: 'Inter, ui-sans-serif, system-ui' },
  { id: 'display', label: 'Outfit (Modern)', value: 'Outfit, ui-sans-serif, system-ui' },
  { id: 'mono', label: 'JetBrains (Mono)', value: 'JetBrains Mono, ui-monospace, SFMono-Regular' },
];

const COLORS = [
  { id: 'orange', label: 'Amber Gold', value: '#f59e0b' },
  { id: 'blue', label: 'Electric Blue', value: '#3b82f6' },
  { id: 'indigo', label: 'Deep Indigo', value: '#6366f1' },
  { id: 'emerald', label: 'Emerald Green', value: '#10b981' },
  { id: 'rose', label: 'Modern Rose', value: '#f43f5e' },
  { id: 'violet', label: 'Classic Violet', value: '#8b5cf6' },
];

export default function SettingsModule({ 
  orders, 
  entries, 
  userProfile, 
  currentTheme, 
  setTheme,
  appSettings,
  updateAppSettings,
  onLogout
}: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'users' | 'theme' | 'layout' | 'about' | 'health'>('profile');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleLogoutClick = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await onLogout();
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
    } catch (err) {
      console.error(err);
    }
  };

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...appSettings, [key]: value };
    updateAppSettings(newSettings);
    
    // Apply visual settings immediately
    if (key === 'primaryColor') {
      document.documentElement.style.setProperty('--color-accent', value);
    }
    if (key === 'fontSize') {
      document.documentElement.style.fontSize = value === 'sm' ? '14px' : value === 'lg' ? '18px' : '16px';
    }
    if (key === 'fontFamily') {
      document.documentElement.style.setProperty('--font-sans', value);
    }
    if (key === 'highContrast') {
      if (value) {
        document.documentElement.classList.add('contrast');
      } else {
        document.documentElement.classList.remove('contrast');
      }
    }
  };

  const tabs = [
    { id: 'profile', label: 'Account', icon: Settings, desc: 'Your personal access' },
    { id: 'theme', label: 'Style & Theme', icon: Palette, desc: 'Colors, fonts & sizes' },
    { id: 'layout', label: 'Layout Design', icon: Grid3X3, desc: 'Navigation positioning' },
    userProfile?.role === 'admin' && { id: 'users', label: 'User Control', icon: Shield, desc: 'Manage factory access' },
    { id: 'health', label: 'System Logs', icon: Activity, desc: 'Live connectivity data' },
    { id: 'about', label: 'Blueprints', icon: Info, desc: 'A-Z App documentation' },
  ].filter(Boolean) as { id: any; label: string; icon: any; desc: string }[];

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-[70vh]">
      {/* Sidebar - Pro Level */}
      <aside className="w-full lg:w-80 space-y-2">
        <div className="p-6 mb-4 rounded-[32px] bg-gradient-to-br from-accent/20 to-indigo-500/10 border border-accent/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-slate-950 font-black text-xl">
              {userProfile?.email?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-black text-fg truncate w-40">{userProfile?.email?.split('@')[0]}</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-accent">Professional Label</p>
            </div>
          </div>
          <p className="text-[11px] font-medium text-muted leading-relaxed">
            Welcome to the Control Center. Customize your workspace and manage factory intelligence from here.
          </p>
        </div>

        <div className="space-y-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full group flex items-center gap-4 p-4 rounded-2xl transition-all border",
                activeTab === tab.id 
                  ? "bg-accent border-accent shadow-lg shadow-accent/20 text-slate-950" 
                  : "bg-card/40 border-border text-muted hover:border-accent/40 hover:text-fg"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                activeTab === tab.id ? "bg-slate-950/20" : "bg-bg border border-border group-hover:bg-accent/5"
              )}>
                <tab.icon size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-black uppercase tracking-tight leading-none mb-1">{tab.label}</div>
                <div className={cn("text-[9px] font-bold uppercase tracking-tighter", activeTab === tab.id ? "text-slate-950/60" : "text-muted/60")}>
                  {tab.desc}
                </div>
              </div>
            </button>
          ))}
        </div>

        <button 
          onClick={handleLogoutClick}
          className="w-full mt-6 flex items-center justify-center gap-3 p-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger font-black uppercase text-xs tracking-[0.2em] hover:bg-danger hover:text-white transition-all"
        >
          <LogOut size={18} />
          Sign Out System
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
          >
            {/* --- USER ACCOUNT --- */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-[40px] p-10 shadow-2xl backdrop-blur-3xl">
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 flex items-center gap-3">
                    <ShieldCheck size={28} className="text-accent" /> Security Credentials
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted">Registerd Email</label>
                       <div className="p-4 bg-bg border border-border rounded-2xl font-bold text-fg/80">{userProfile?.email}</div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted">System Rank</label>
                       <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl font-black text-accent uppercase tracking-[0.2em]">{userProfile?.role}</div>
                    </div>
                  </div>
                  <div className="mt-10 p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-6">
                     <div className="p-4 rounded-2xl bg-indigo-500/10 text-indigo-400">
                        <LockIcon size={24} />
                     </div>
                     <div>
                        <h4 className="text-sm font-black uppercase">Two-Factor Auth</h4>
                        <p className="text-xs text-muted mt-1">Enhance your factory account security with 2FA protection.</p>
                     </div>
                     <button className="ml-auto btn btn-s">Enable</button>
                  </div>
                </div>
              </div>
            )}

            {/* --- THEME CUSTOMIZATION - PRO ENGINE --- */}
            {activeTab === 'theme' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Visual Colors */}
                  <div className="bg-card border border-border rounded-[40px] p-8 shadow-xl">
                    <h4 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest mb-6">
                      <Palette size={18} className="text-accent" /> Accent Palette
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      {COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => updateSetting('primaryColor', c.value)}
                          className={cn(
                            "group flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all",
                            appSettings.primaryColor === c.value ? "border-accent bg-accent/5" : "border-border bg-bg/40 hover:border-white/20"
                          )}
                        >
                          <div className="w-8 h-8 rounded-full shadow-lg" style={{ backgroundColor: c.value }} />
                          <span className="text-[9px] font-black uppercase tracking-tighter">{c.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Styling */}
                  <div className="bg-card border border-border rounded-[40px] p-8 shadow-xl">
                    <h4 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest mb-6">
                      <FontTypeIcon size={18} className="text-indigo-400" /> Typography
                    </h4>
                    <div className="space-y-3">
                      {FONT_FAMILIES.map(f => (
                        <button
                          key={f.id}
                          onClick={() => updateSetting('fontFamily', f.value)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                            appSettings.fontFamily === f.value ? "border-accent bg-accent/10 text-accent" : "border-border bg-bg/40 hover:border-white/20"
                          )}
                        >
                          <span style={{ fontFamily: f.value }} className="text-sm font-bold">{f.label}</span>
                          {appSettings.fontFamily === f.value && <CheckCircle2 size={16} />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[40px] p-8 shadow-xl">
                  <div className="flex items-center justify-between gap-8 flex-wrap">
                    <div className="flex-1 space-y-4">
                      <h4 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                        <Maximize size={18} className="text-success" /> Scale & Surface
                      </h4>
                      <div className="flex gap-4">
                        {['sm', 'md', 'lg'].map(size => (
                          <button
                            key={size}
                            onClick={() => updateSetting('fontSize', size)}
                            className={cn(
                              "px-6 py-3 rounded-xl border font-black uppercase text-[10px] tracking-widest transition-all",
                              appSettings.fontSize === size ? "bg-success text-slate-950 border-success shadow-lg" : "bg-bg border-border text-muted"
                            )}
                          >
                            {size === 'sm' ? 'Compact' : size === 'lg' ? 'Large' : 'Normal'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 space-y-4">
                      <h4 className="flex items-center gap-3 text-sm font-black uppercase tracking-widest">
                        <Contrast size={18} className="text-indigo-400" /> Mode Context
                      </h4>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => setTheme('dark')}
                          className={cn("flex-1 p-4 rounded-2xl border flex items-center gap-3 transition-all", currentTheme === 'dark' ? "bg-indigo-500 text-white border-indigo-500" : "bg-bg border-border text-muted")}
                        >
                          <MonitorIcon size={18} /> <span className="text-xs font-black uppercase">Deep Slate</span>
                        </button>
                        <button 
                          onClick={() => setTheme('light')}
                          className={cn("flex-1 p-4 rounded-2xl border flex items-center gap-3 transition-all", currentTheme === 'light' ? "bg-accent text-slate-950 border-accent" : "bg-bg border-border text-muted")}
                        >
                          <Zap size={18} /> <span className="text-xs font-black uppercase">Vibrant Light</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[40px] p-8 shadow-xl">
                   <div className="flex items-center justify-between">
                      <div>
                         <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                            <Shield size={18} className="text-accent" /> Ultra High Contrast
                         </h4>
                         <p className="text-[10px] text-muted font-bold mt-1 uppercase">Pure black & white mode for extreme readability</p>
                      </div>
                      <button 
                        onClick={() => updateSetting('highContrast', !appSettings.highContrast)}
                        className={cn(
                          "w-16 h-8 rounded-full relative transition-all duration-300",
                          appSettings.highContrast ? "bg-accent" : "bg-white/10"
                        )}
                      >
                         <motion.div 
                           animate={{ x: appSettings.highContrast ? 32 : 4 }}
                           className="w-6 h-6 rounded-full bg-slate-950 absolute top-1 shadow-lg"
                         />
                      </button>
                   </div>
                </div>
              </div>
            )}

            {/* --- LAYOUT SWITCHER --- */}
            {activeTab === 'layout' && (
              <div className="space-y-8">
                <div className="bg-card border border-border rounded-[40px] p-10 shadow-xl">
                  <h3 className="text-2xl font-black uppercase tracking-tighter mb-10">Application Structure</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <button 
                      onClick={() => updateSetting('navPosition', 'top')}
                      className={cn(
                        "group relative rounded-3xl border-2 p-1 transition-all overflow-hidden aspect-video",
                        appSettings.navPosition === 'top' ? "border-accent shadow-2xl" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="h-full bg-slate-950 rounded-[22px] flex flex-col p-2 gap-2">
                        <div className="h-4 w-full bg-accent/20 rounded-md" />
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div className="bg-white/5 rounded-md" />
                          <div className="bg-white/5 rounded-md" />
                          <div className="bg-white/5 rounded-md" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover:bg-slate-950/40 transition-all">
                        <div className="flex items-center gap-2 bg-accent text-slate-950 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">
                          <Compass size={14} /> Top Navigation
                        </div>
                      </div>
                    </button>

                    <button 
                      onClick={() => updateSetting('navPosition', 'side')}
                      className={cn(
                        "group relative rounded-3xl border-2 p-1 transition-all overflow-hidden aspect-video",
                        appSettings.navPosition === 'side' ? "border-accent shadow-2xl" : "border-transparent opacity-60 hover:opacity-100"
                      )}
                    >
                      <div className="h-full bg-slate-950 rounded-[22px] flex p-2 gap-2">
                        <div className="w-8 h-full bg-accent/20 rounded-md" />
                        <div className="flex-1 grid grid-rows-3 gap-2">
                          <div className="bg-white/5 rounded-md" />
                          <div className="bg-white/5 rounded-md" />
                          <div className="bg-white/5 rounded-md" />
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/0 group-hover:bg-slate-950/40 transition-all">
                        <div className="flex items-center gap-2 bg-accent text-slate-950 px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl">
                          <Columns2 size={14} /> Left Sidebar
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-[40px] p-8 mt-8 shadow-xl">
                   <div className="flex items-center justify-between">
                      <div>
                         <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                            <Maximize size={18} className="text-accent" /> Compact Sidebar
                         </h4>
                         <p className="text-[10px] text-muted font-bold mt-1 uppercase">Collapse navigation to an icon-only slim bar</p>
                      </div>
                      <button 
                        onClick={() => updateSetting('compactMode', !appSettings.compactMode)}
                        className={cn(
                          "w-16 h-8 rounded-full relative transition-all duration-300",
                          appSettings.compactMode ? "bg-accent" : "bg-white/10"
                        )}
                      >
                         <motion.div 
                           animate={{ x: appSettings.compactMode ? 32 : 4 }}
                           className="w-6 h-6 rounded-full bg-slate-950 absolute top-1 shadow-lg"
                         />
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 p-8 bg-accent/5 border border-accent/20 rounded-[40px] mt-8">
                  <RefreshCw className="text-accent animate-spin-slow" />
                  <p className="text-sm font-medium text-muted">Changing navigation requires a layout recalculation. Your preferences are saved instantly.</p>
                </div>
              </div>
            )}

            {/* --- USER CONTROL (ADMIN) --- */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-[40px] overflow-hidden shadow-2xl">
                  <div className="p-8 border-b border-border flex items-center justify-between">
                    <h3 className="text-xl font-black uppercase tracking-tight">Active Factory Users</h3>
                    <span className="bg-accent/10 text-accent font-black text-[10px] uppercase px-3 py-1 rounded-full">{users.length} Users</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-bg/50 border-b border-border">
                        <tr>
                          <th className="px-8 py-4 text-[10px] font-black uppercase text-muted tracking-[0.2em]">Profile</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase text-muted tracking-[0.2em]">Role</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase text-muted tracking-[0.2em]">Status</th>
                          <th className="px-8 py-4 text-[10px] font-black uppercase text-muted tracking-[0.2em] text-right">Access</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {users.map(u => (
                          <tr key={u.id} className="hover:bg-accent/5 transition-all">
                            <td className="px-8 py-5">
                              <div className="font-bold text-fg text-sm">{u.email}</div>
                              <div className="text-[10px] text-muted">Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}</div>
                            </td>
                            <td className="px-8 py-5">
                              <span className="p-1 px-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                {u.role}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <span className={cn(
                                "p-1 px-3 rounded-lg text-[10px] font-bold uppercase border",
                                u.status === 'suspended' ? "bg-danger/10 text-danger border-danger/20" : "bg-success/10 text-success border-success/20"
                              )}>
                                {u.status || 'active'}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleStatusChange(u.id, u.status === 'suspended' ? 'active' : 'suspended')}
                                  disabled={u.email === 'aknahian@gmail.com'}
                                  className={cn("p-2 rounded-xl transition-all", u.status === 'suspended' ? "text-success bg-success/10" : "text-danger bg-danger/10")}
                                >
                                  {u.status === 'suspended' ? <UserCheck size={16} /> : <UserX size={16} />}
                                </button>
                                <button className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-xl transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- ABOUT & BLUEPRINT --- */}
            {activeTab === 'about' && (
              <AboutSection />
            )}

            {/* --- SYSTEM HEALTH --- */}
            {activeTab === 'health' && (
               <SystemHealth orders={orders} entries={entries} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
