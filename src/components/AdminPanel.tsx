import React, { useState, useEffect, useMemo } from 'react';
import { db, addAuditLog } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  getDocs, 
  writeBatch, 
  deleteDoc,
  where,
  Timestamp
} from 'firebase/firestore';
import { 
  Shield, 
  Users, 
  Clock, 
  Activity, 
  Search, 
  Settings, 
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Lock,
  LayoutDashboard,
  UserX,
  UserCheck,
  RefreshCw,
  Building2,
  ToggleLeft,
  ToggleRight,
  FileDown,
  FileText,
  Database,
  Filter,
  X,
  Eraser,
  LogIn
} from 'lucide-react';
import { format, subHours, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Order, ProductionEntry, AppUser, AuditLogEntry, UserRole, UserStatus } from '../types';

interface AdminPanelProps {
  orders: Order[];
  entries: ProductionEntry[];
}

const ROLES: { id: UserRole; label: string; color: string }[] = [
  { id: 'super-admin', label: 'Super Admin', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { id: 'admin', label: 'Admin', color: 'bg-accent/20 text-accent border-accent/30' },
  { id: 'supervisor', label: 'Supervisor', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { id: 'operator', label: 'Operator', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { id: 'viewer', label: 'Viewer', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
];

const PERMISSIONS = [
  { id: 'view-data', label: 'View Data', group: 'General' },
  { id: 'add-entry', label: 'Add Entries', group: 'Production' },
  { id: 'edit-entry', label: 'Edit Entries', group: 'Production' },
  { id: 'delete-entry', label: 'Delete Entries', group: 'Production' },
  { id: 'manage-orders', label: 'Manage Orders', group: 'Orders' },
  { id: 'download-pdf', label: 'Download PDF', group: 'Reports' },
  { id: 'view-reports', label: 'View Reports', group: 'Reports' },
  { id: 'manage-users', label: 'Manage Users', group: 'Admin' },
  { id: 'change-settings', label: 'Change Settings', group: 'Admin' },
];

type SubTab = 'dashboard' | 'users' | 'roles' | 'logs' | 'stats' | 'settings';

export default function AdminPanel({ orders, entries }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('dashboard');
  const [users, setUsers] = useState<AppUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('ALPHA CLOTHING LTD');
  
  // Filters for logs
  const [logFilter, setLogFilter] = useState({
    user: '',
    date: '',
  });

  useEffect(() => {
    // Fetch Users
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
      setUsers(usersData);
    });

    // Fetch Logs
    const qLogs = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(200));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLogEntry));
      setLogs(logsData);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubLogs();
    };
  }, []);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      await addAuditLog('EDIT', 'USER', `Changed role of ${userId} to ${newRole}`, `/admin/users`);
    } catch (err) {
      console.error('Error updating role:', err);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      await addAuditLog('STATUS_CHANGE', 'USER', `Changed status of ${userId} to ${newStatus}`, `/admin/users`);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePermissionToggle = async (userId: string, permission: string, currentPermissions: string[] = []) => {
    try {
      const newPermissions = currentPermissions.includes(permission)
        ? currentPermissions.filter(p => p !== permission)
        : [...currentPermissions, permission];
      
      await updateDoc(doc(db, 'users', userId), { permissions: newPermissions });
      await addAuditLog('PERMISSION_CHANGE', 'USER', `Updated permissions for ${userId}: ${permission}`, `/admin/users`);
    } catch (err) {
      console.error('Error updating permissions:', err);
    }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (email === 'aknahian@gmail.com') return;
    if (!window.confirm(`Are you sure you want to delete user ${email}? This cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', userId));
      await addAuditLog('DELETE', 'USER', `Deleted user ${email}`, `/admin/users`);
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all audit logs? This action cannot be undone.')) return;
    
    setIsClearing(true);
    try {
      const q = query(collection(db, 'auditLogs'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      await addAuditLog('DELETE', 'USER', 'Cleared all audit logs', '/admin/logs');
    } catch (err) {
      console.error('Error clearing logs:', err);
    } finally {
      setIsClearing(false);
    }
  };

  // --- Stats Calculations ---
  const stats = useMemo(() => {
    const now = new Date();
    const last24h = subHours(now, 24);
    const todayStart = startOfDay(now);
    
    const active24h = users.filter(u => u.lastLogin && new Date(u.lastLogin) > last24h).length;
    const suspended = users.filter(u => u.status === 'suspended').length;
    const entriesToday = entries.filter(e => new Date(e.date) >= todayStart).length;
    const loginsToday = logs.filter(l => l.action === 'LOGIN' && new Date(l.timestamp) >= todayStart).length;

    return {
      totalUsers: users.length,
      active24h,
      suspended,
      entriesToday,
      loginsToday
    };
  }, [users, entries, logs]);

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = logs.filter(log => {
    const matchesSearch = log.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
                         log.action?.toLowerCase().includes(search.toLowerCase()) ||
                         log.details?.toLowerCase().includes(search.toLowerCase());
    const matchesUser = !logFilter.user || log.userEmail === logFilter.user;
    const matchesDate = !logFilter.date || log.timestamp.startsWith(logFilter.date);
    return matchesSearch && matchesUser && matchesDate;
  });

  const sidebarItems: { id: SubTab; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'logs', label: 'Audit Logs', icon: Clock },
    { id: 'stats', label: 'System Stats', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[70vh]">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-64 flex flex-col gap-1 no-print">
        <div className="px-4 py-3 mb-2 bg-accent/5 border border-accent/20 rounded-xl">
          <div className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">Admin Mode</div>
          <div className="text-sm font-bold text-fg truncate">{companyName}</div>
        </div>
        
        {sidebarItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSubTab(item.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
              activeSubTab === item.id 
                ? "bg-accent text-black shadow-lg shadow-accent/20" 
                : "text-muted hover:bg-accent/5 hover:text-fg"
            )}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSubTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* --- DASHBOARD SUMMARY --- */}
            {activeSubTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {[
                    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-blue-400' },
                    { label: 'Active (24h)', value: stats.active24h, icon: UserCheck, color: 'text-green-400' },
                    { label: 'Suspended', value: stats.suspended, icon: UserX, color: 'text-red-400' },
                    { label: 'Entries Today', value: stats.entriesToday, icon: FileText, color: 'text-accent' },
                    { label: 'Logins Today', value: stats.loginsToday, icon: LogIn, color: 'text-purple-400' },
                  ].map((card, i) => (
                    <div key={i} className="bg-card border border-border p-5 rounded-2xl shadow-xl hover:border-accent/30 transition-all group">
                      <div className="flex items-center justify-between mb-3">
                        <div className={cn("p-2 rounded-lg bg-bg border border-border group-hover:scale-110 transition-transform", card.color)}>
                          <card.icon size={20} />
                        </div>
                        <div className="text-2xl font-black text-fg">{card.value}</div>
                      </div>
                      <div className="text-[10px] font-bold text-muted uppercase tracking-widest">{card.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Activity size={16} className="text-accent" /> Recent Activity
                    </h3>
                    <div className="space-y-4">
                      {logs.slice(0, 5).map(log => (
                        <div key={log.id} className="flex items-start gap-3 text-xs border-l-2 border-accent/20 pl-4 py-1">
                          <div className="flex-1">
                            <div className="font-bold text-fg">{log.userEmail}</div>
                            <div className="text-muted mt-0.5">{log.details}</div>
                          </div>
                          <div className="text-[10px] text-muted font-mono">{format(new Date(log.timestamp), 'HH:mm')}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <BarChart3 size={16} className="text-accent" /> System Health
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Firestore Connection</span>
                        <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase">Stable</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Auth Service</span>
                        <span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded-full uppercase">Online</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted">Data Sync Latency</span>
                        <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-0.5 rounded-full uppercase">Low</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- USER MANAGEMENT --- */}
            {activeSubTab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
                    <input
                      type="text"
                      placeholder="Search by email or role..."
                      className="fi pl-10 py-2.5 text-sm"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg2 border-b border-border">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">User</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Role</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Status</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Last Active</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-accent/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-sm">
                                  {u.email?.charAt(0).toUpperCase()}
                                </div>
                                <div className="font-bold text-fg">{u.email}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-bold uppercase border",
                                ROLES.find(r => r.id === u.role)?.color || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-bold uppercase border",
                                u.status === 'suspended' ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-green-500/20 text-green-400 border-green-500/30"
                              )}>
                                {u.status || 'active'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[10px] text-muted font-mono">
                              {u.lastLogin ? format(new Date(u.lastLogin), 'dd-MMM-yy HH:mm') : 'Never'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button 
                                  onClick={() => handleStatusChange(u.id, u.status === 'suspended' ? 'active' : 'suspended')}
                                  className={cn("p-1.5 rounded-lg transition-colors", u.status === 'suspended' ? "text-green-400 hover:bg-green-400/10" : "text-red-400 hover:bg-red-400/10")}
                                  title={u.status === 'suspended' ? 'Activate' : 'Suspend'}
                                  disabled={u.email === 'aknahian@gmail.com'}
                                >
                                  {u.status === 'suspended' ? <UserCheck size={16} /> : <UserX size={16} />}
                                </button>
                                <button 
                                  onClick={() => setExpandedUserId(expandedUserId === u.id ? null : u.id)}
                                  className="p-1.5 text-muted hover:text-accent transition-colors"
                                  title="Edit Role/Permissions"
                                >
                                  <Settings size={16} />
                                </button>
                                <button 
                                  onClick={() => deleteUser(u.id, u.email)}
                                  className="p-1.5 text-muted hover:text-red-400 transition-colors"
                                  title="Delete User"
                                  disabled={u.email === 'aknahian@gmail.com'}
                                >
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

            {/* --- ROLES & PERMISSIONS --- */}
            {activeSubTab === 'roles' && (
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-bold mb-6 flex items-center gap-2">
                    <Shield size={18} className="text-accent" /> Role Permission Matrix
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="py-4 px-4 text-[10px] font-bold uppercase text-muted">Permission</th>
                          {ROLES.map(role => (
                            <th key={role.id} className="py-4 px-4 text-center">
                              <div className={cn("inline-block px-2 py-1 rounded text-[9px] font-bold uppercase border", role.color)}>
                                {role.label}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {PERMISSIONS.map(perm => (
                          <tr key={perm.id} className="hover:bg-accent/5 transition-colors">
                            <td className="py-4 px-4">
                              <div className="text-xs font-bold text-fg">{perm.label}</div>
                              <div className="text-[9px] text-muted uppercase tracking-tighter">{perm.group}</div>
                            </td>
                            {ROLES.map(role => (
                              <td key={role.id} className="py-4 px-4 text-center">
                                <div className="flex justify-center">
                                  {role.id === 'super-admin' ? (
                                    <CheckCircle2 size={16} className="text-accent" />
                                  ) : (
                                    <div className="w-4 h-4 rounded border border-border bg-bg flex items-center justify-center">
                                      {/* This is a visualization, in a real app you'd map role-to-perms here */}
                                      <div className="w-1.5 h-1.5 rounded-full bg-accent/20" />
                                    </div>
                                  )}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- AUDIT LOGS --- */}
            {activeSubTab === 'logs' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap bg-card border border-border p-4 rounded-xl shadow-lg">
                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                    <Filter size={16} className="text-accent" />
                    <select 
                      className="fi h-9 text-xs py-0"
                      value={logFilter.user}
                      onChange={e => setLogFilter(prev => ({ ...prev, user: e.target.value }))}
                    >
                      <option value="">All Users</option>
                      {Array.from(new Set(logs.map(l => l.userEmail))).map(email => (
                        <option key={email} value={email}>{email}</option>
                      ))}
                    </select>
                    <input 
                      type="date" 
                      className="fi h-9 text-xs py-0"
                      value={logFilter.date}
                      onChange={e => setLogFilter(prev => ({ ...prev, date: e.target.value }))}
                    />
                    <button 
                      onClick={() => setLogFilter({ user: '', date: '' })}
                      className="text-xs text-muted hover:text-accent flex items-center gap-1"
                    >
                      <X size={14} /> Reset
                    </button>
                  </div>
                  <button 
                    onClick={clearLogs}
                    disabled={isClearing || logs.length === 0}
                    className="btn btn-d btn-s flex items-center gap-2 h-9"
                  >
                    <Eraser size={14} /> Clear Logs
                  </button>
                </div>

                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg2 border-b border-border">
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Timestamp</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">User</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Action</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Module</th>
                          <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-accent/5 transition-colors">
                            <td className="px-6 py-4 text-[10px] font-mono text-muted">
                              {format(new Date(log.timestamp), 'dd-MMM-yy HH:mm:ss')}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-fg">{log.userEmail}</td>
                            <td className="px-6 py-4">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                log.action === 'ADD' ? "bg-green-500/10 text-green-400" :
                                log.action === 'EDIT' ? "bg-blue-500/10 text-blue-400" :
                                log.action === 'DELETE' ? "bg-red-500/10 text-red-400" :
                                "bg-accent/10 text-accent"
                              )}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-[10px] font-bold text-muted uppercase tracking-tighter">{log.entity}</td>
                            <td className="px-6 py-4 text-xs text-muted max-w-xs truncate">{log.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --- SYSTEM STATS --- */}
            {activeSubTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total Orders</div>
                    <div className="text-3xl font-black text-accent">{orders.length}</div>
                    <div className="text-[10px] text-muted mt-2">Active orders in database</div>
                  </div>
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total Entries</div>
                    <div className="text-3xl font-black text-blue-400">{entries.length}</div>
                    <div className="text-[10px] text-muted mt-2">Production records synced</div>
                  </div>
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total Qty</div>
                    <div className="text-3xl font-black text-green-400">
                      {orders.reduce((s, o) => s + o.orderQty, 0).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted mt-2">Total order volume</div>
                  </div>
                  <div className="bg-card border border-border p-6 rounded-2xl shadow-xl">
                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Avg Achievement</div>
                    <div className="text-3xl font-black text-purple-400">
                      {entries.length > 0 ? Math.round(entries.reduce((s, e) => s + (e.poly || 0), 0) / orders.reduce((s, o) => s + o.orderQty, 0) * 100) : 0}%
                    </div>
                    <div className="text-[10px] text-muted mt-2">Global production efficiency</div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-2xl p-8 shadow-xl text-center py-20">
                  <BarChart3 size={48} className="mx-auto text-accent/20 mb-4" />
                  <h3 className="text-lg font-bold">Advanced Analytics</h3>
                  <p className="text-sm text-muted max-w-md mx-auto mt-2">
                    Detailed production trends and worker efficiency charts will be available in the next system update.
                  </p>
                </div>
              </div>
            )}

            {/* --- SYSTEM SETTINGS --- */}
            {activeSubTab === 'settings' && (
              <div className="max-w-2xl space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-6">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Building2 size={18} className="text-accent" /> General Settings
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Company Name</label>
                      <input 
                        type="text" 
                        value={companyName}
                        onChange={e => setCompanyName(e.target.value)}
                        className="fi"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-bg rounded-xl border border-border">
                      <div>
                        <div className="text-sm font-bold">Maintenance Mode</div>
                        <div className="text-[10px] text-muted">Restrict access to all users except admins</div>
                      </div>
                      <button className="text-muted hover:text-accent transition-colors">
                        <ToggleLeft size={32} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-bg rounded-xl border border-border">
                      <div>
                        <div className="text-sm font-bold">Audit Log Retention</div>
                        <div className="text-[10px] text-muted">Automatically clear logs older than 90 days</div>
                      </div>
                      <button className="text-accent transition-colors">
                        <ToggleRight size={32} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex justify-end">
                    <button className="btn btn-p px-8" onClick={() => alert('Settings saved locally')}>
                      Save Changes
                    </button>
                  </div>
                </div>

                <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 shadow-xl">
                  <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-4">
                    <AlertCircle size={18} /> Danger Zone
                  </h3>
                  <p className="text-xs text-muted mb-4">Actions here are irreversible and impact the entire system.</p>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn btn-d btn-s" onClick={() => alert('This would reset all production data')}>
                      Reset Production Data
                    </button>
                    <button className="btn btn-d btn-s" onClick={() => alert('This would clear all user accounts')}>
                      Clear User Database
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* User Edit Modal (Overlay) */}
      <AnimatePresence>
        {expandedUserId && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setExpandedUserId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-card border border-border rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              {users.find(u => u.id === expandedUserId) && (
                <div className="flex flex-col h-full max-h-[90vh]">
                  <div className="p-6 border-b border-border bg-bg2 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent text-xl font-bold">
                        {users.find(u => u.id === expandedUserId)?.email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold">{users.find(u => u.id === expandedUserId)?.email}</h3>
                        <p className="text-xs text-muted">Manage Access & Permissions</p>
                      </div>
                    </div>
                    <button onClick={() => setExpandedUserId(null)} className="p-2 text-muted hover:text-fg transition-colors">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="p-8 overflow-y-auto space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-accent uppercase tracking-widest">System Role</label>
                        <div className="grid grid-cols-1 gap-2">
                          {ROLES.map(role => (
                            <button
                              key={role.id}
                              onClick={() => handleRoleChange(expandedUserId!, role.id)}
                              disabled={users.find(u => u.id === expandedUserId)?.email === 'aknahian@gmail.com'}
                              className={cn(
                                "flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-left",
                                users.find(u => u.id === expandedUserId)?.role === role.id
                                  ? "bg-accent/10 border-accent text-accent"
                                  : "bg-bg border-border text-muted hover:border-accent/30"
                              )}
                            >
                              <span className="text-sm font-bold">{role.label}</span>
                              {users.find(u => u.id === expandedUserId)?.role === role.id && <CheckCircle2 size={16} />}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <label className="text-[10px] font-bold text-accent uppercase tracking-widest">Granular Permissions</label>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                          {PERMISSIONS.map(perm => (
                            <label 
                              key={perm.id}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer group",
                                users.find(u => u.id === expandedUserId)?.role === 'super-admin' || users.find(u => u.id === expandedUserId)?.role === 'admin'
                                  ? "opacity-50 cursor-not-allowed bg-bg border-border"
                                  : users.find(u => u.id === expandedUserId)?.permissions?.includes(perm.id)
                                    ? "bg-accent/5 border-accent/30"
                                    : "bg-bg border-border hover:border-accent/30"
                              )}
                            >
                              <div>
                                <div className="text-xs font-bold">{perm.label}</div>
                                <div className="text-[9px] text-muted uppercase">{perm.group}</div>
                              </div>
                              <input 
                                type="checkbox"
                                checked={!!(users.find(u => u.id === expandedUserId)?.role === 'admin' || users.find(u => u.id === expandedUserId)?.role === 'super-admin' || users.find(u => u.id === expandedUserId)?.permissions?.includes(perm.id))}
                                onChange={() => handlePermissionToggle(expandedUserId!, perm.id, users.find(u => u.id === expandedUserId)?.permissions)}
                                disabled={users.find(u => u.id === expandedUserId)?.role === 'admin' || users.find(u => u.id === expandedUserId)?.role === 'super-admin'}
                                className="w-4 h-4 rounded border-border bg-bg text-accent focus:ring-accent"
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t border-border bg-bg2 flex justify-between items-center">
                    <div className="text-[10px] text-muted italic">
                      Admin roles inherit all permissions automatically.
                    </div>
                    <button onClick={() => setExpandedUserId(null)} className="btn btn-p px-10">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

