import React, { useState, useMemo, useEffect } from 'react';
import { 
  Keyboard, 
  Database, 
  Save, 
  Eraser, 
  Trash2, 
  Filter, 
  X,
  Search,
  ArrowRight,
  TrendingUp,
  Activity,
  AlertTriangle,
  Plus,
  Pencil
} from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry, POInfo } from '../types';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { db, addAuditLog, auth } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import CollectFromExcelModal from './CollectFromExcelModal';

interface DataEntryProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
  addToast: (msg: string, type?: 'ok' | 'er' | 'in') => void;
  userProfile: { role: string; permissions?: string[] } | null;
}

export default React.memo(function DataEntry({ orders, entries, getPOInfo, addToast, userProfile }: DataEntryProps) {
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('production_entry_autosave');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback if data is corrupted
      }
    }
    return {
      date: format(new Date(), 'yyyy-MM-dd'),
      poNo: '',
      color: '',
      cut: 0,
      sewOut: 0,
      washR: 0,
      finIn: 0,
      finOut: 0,
      poly: 0,
      shipment: 0,
      lineNo: '',
      floor: ''
    };
  });

  const hasPermission = (p: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const [editingEntryId, setEditingEntryId] = useState<string | number | null>(() => {
    const saved = localStorage.getItem('production_entry_editing_id');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    localStorage.setItem('production_entry_autosave', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    if (editingEntryId) {
      localStorage.setItem('production_entry_editing_id', JSON.stringify(editingEntryId));
    } else {
      localStorage.removeItem('production_entry_editing_id');
    }
  }, [editingEntryId]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(100);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEntries.map(e => String(e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    setLoading(true);
    try {
      const deletePromises = selectedIds.map(id => deleteDoc(doc(db, 'entries', id)));
      await Promise.all(deletePromises);
      
      await addAuditLog(
        'DELETE', 
        'ENTRY', 
        `Bulk Deleted ${selectedIds.length} Entries`,
        '/entries/bulk'
      );

      addToast(`${selectedIds.length} entries deleted`, 'in');
      setSelectedIds([]);
      setBulkDeleteConfirm(false);
    } catch (err) {
      addToast('Failed to delete entries', 'er');
    } finally {
      setLoading(false);
    }
  };

  const [filters, setFilters] = useState({
    date: '',
    poNo: '',
    buyer: '',
    color: ''
  });

  const poInfo = useMemo(() => getPOInfo(formData.poNo), [formData.poNo, orders]);
  
  const selectedColorRow = useMemo(() => {
    if (!poInfo || !formData.color) return null;
    return poInfo.colorRows.find(r => r.color === formData.color);
  }, [poInfo, formData.color]);

  const cumulativeStats = useMemo(() => {
    if (!formData.poNo || !formData.color) return { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0 };
    return entries
      .filter(e => e.poNo === formData.poNo && e.color === formData.color)
      .reduce((acc, e) => ({
        cut: acc.cut + e.cut,
        sewOut: acc.sewOut + e.sewOut,
        washR: acc.washR + e.washR,
        finIn: acc.finIn + e.finIn,
        finOut: acc.finOut + e.finOut,
        poly: acc.poly + e.poly,
        shipment: acc.shipment + e.shipment,
      }), { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0, shipment: 0 });
  }, [formData.poNo, formData.color, entries]);

  const achievement = selectedColorRow?.orderQty ? Math.round((cumulativeStats.poly / selectedColorRow.orderQty) * 100 * 10) / 10 : 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const clearForm = () => {
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      poNo: '',
      color: '',
      cut: 0,
      sewOut: 0,
      washR: 0,
      finIn: 0,
      finOut: 0,
      poly: 0,
      shipment: 0,
      lineNo: '',
      floor: ''
    });
    setEditingEntryId(null);
    localStorage.removeItem('production_entry_autosave');
    localStorage.removeItem('production_entry_editing_id');
  };

  const editEntry = (entry: ProductionEntry) => {
    setFormData({
      date: entry.date || format(new Date(), 'yyyy-MM-dd'),
      poNo: entry.poNo || '',
      color: entry.color || '',
      cut: entry.cut || 0,
      sewOut: entry.sewOut || 0,
      washR: entry.washR || 0,
      finIn: entry.finIn || 0,
      finOut: entry.finOut || 0,
      poly: entry.poly || 0,
      shipment: entry.shipment || 0,
      lineNo: entry.lineNo || '',
      floor: entry.floor || ''
    });
    setEditingEntryId(entry.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.date || !formData.poNo || !formData.color) {
      addToast('Select Date, PO and Color', 'er');
      return;
    }
    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        updatedAt: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'anonymous'
      };

      if (editingEntryId) {
        await updateDoc(doc(db, 'entries', String(editingEntryId)), dataToSave);
        addToast('Data stream updated', 'ok');
      } else {
        await addDoc(collection(db, 'entries'), {
          ...dataToSave,
          createdAt: new Date().toISOString()
        });
        addToast('Data stream initialized', 'ok');
      }
      
      await addAuditLog(
        editingEntryId ? 'EDIT' : 'ADD',
        'ENTRY',
        `${editingEntryId ? 'Updated' : 'Created'} Entry: PO ${formData.poNo}, Color ${formData.color}`,
        `/entries/${editingEntryId || 'new'}`
      );

      closeForm();
    } catch (err) {
      console.error(err);
      addToast('Failed to save data stream', 'er');
    } finally {
      setLoading(false);
    }
  };

  const openForm = () => {
    clearForm();
    setIsFormOpen(true);
    setLoading(false);
  };
  const closeForm = () => {
    setIsFormOpen(false);
    clearForm();
  };

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      setLoading(true);
      try {
        const entryToDelete = entries.find(e => e.id === deleteConfirmId);
        await deleteDoc(doc(db, 'entries', String(deleteConfirmId)));
        
        await addAuditLog(
          'DELETE', 
          'ENTRY', 
          `Deleted Entry: PO ${entryToDelete?.poNo}, Date ${entryToDelete?.date}`,
          `/entries/${deleteConfirmId}`
        );

        addToast('Entry deleted', 'in');
        setDeleteConfirmId(null);
      } catch (err) {
        addToast('Failed to delete entry', 'er');
      } finally {
        setLoading(false);
      }
    }
  };

  const filteredEntries = useMemo(() => {
    let result = [...entries];
    if (filters.date) result = result.filter(e => e.date === filters.date);
    if (filters.poNo) result = result.filter(e => e.poNo === filters.poNo);
    if (filters.buyer) {
      result = result.filter(e => {
        const info = getPOInfo(e.poNo);
        return info?.buyer === filters.buyer;
      });
    }
    if (filters.color) {
      result = result.filter(e => e.color.toLowerCase().includes(filters.color.toLowerCase()));
    }
    return result.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return String(b.id).localeCompare(String(a.id));
    });
  }, [entries, filters, getPOInfo]);

  const displayedEntries = useMemo(() => {
    return filteredEntries.slice(0, displayLimit);
  }, [filteredEntries, displayLimit]);

  const uniquePOs = Array.from(new Set(orders.map(o => o.poNo)));
  const uniqueBuyers = Array.from(new Set(orders.map(o => o.buyer)));

  const wipMap = useMemo(() => {
    const map: Record<string, any> = {};
    entries.forEach(e => {
      const key = `${e.poNo}-${e.color}`;
      if (!map[key]) {
        map[key] = { cut: 0, sewOut: 0, washR: 0, finIn: 0, finOut: 0, poly: 0 };
      }
      map[key].cut += e.cut || 0;
      map[key].sewOut += e.sewOut || 0;
      map[key].washR += e.washR || 0;
      map[key].finIn += e.finIn || 0;
      map[key].finOut += e.finOut || 0;
      map[key].poly += e.poly || 0;
    });
    return map;
  }, [entries]);

  const getWIPClass = (val: number) => {
    if (val > 500) return "bg-danger/20 text-danger font-black rounded px-1 min-w-[40px] inline-block text-center ring-1 ring-danger/30";
    if (val > 200) return "bg-accent/10 text-accent font-bold px-1 rounded min-w-[40px] inline-block text-center";
    return "text-muted/70 font-mono";
  };

  return (
    <div className="h-full flex flex-col gap-4 relative">
      {/* Header Info - Floating & Minimal */}
      <div className="flex items-center justify-between px-2 pb-4 border-b border-white/5 relative z-30">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent shadow-lg border border-accent/20">
             <Keyboard size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Data Entry</h2>
              <div className="flex items-center gap-2">
                {hasPermission('add-entry') && (
                  <button 
                    type="button"
                    onClick={openForm}
                    className="w-7 h-7 bg-accent/10 text-accent rounded-lg flex items-center justify-center hover:bg-accent hover:text-white transition-all border border-accent/30 group shadow-lg pointer-events-auto"
                    title="Initiate Production Node"
                  >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all border pointer-events-auto",
                    isFiltersOpen 
                      ? "bg-accent text-white border-accent shadow-lg" 
                      : "bg-white/5 border-white/10 text-muted hover:text-fg hover:bg-white/10"
                  )}
                  title="Toggle Scope & Filters"
                >
                  <Filter size={14} />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
               <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
               <p className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">Synchronized Flux Matrix</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-50">
           <button 
             type="button" 
             onClick={() => {
               setIsCollectModalOpen(true);
             }}
             className="h-10 px-5 bg-accent/20 text-accent border border-accent/40 rounded-xl flex items-center gap-2 hover:bg-accent hover:text-white transition-all group shadow-[0_0_15px_rgba(var(--color-accent),0.2)] active:scale-95"
           >
             <Database size={16} className="group-hover:rotate-12 transition-transform" />
             <span className="text-[10px] font-black uppercase tracking-widest">Collect From Library</span>
           </button>
        </div>
      </div>


      {/* Filters (Floating Bar) */}
      <AnimatePresence>
        {isFiltersOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-bg2/40 backdrop-blur-2xl border border-border/20 p-4 rounded-2xl flex flex-wrap gap-4 items-end shadow-2xl relative z-40"
          >
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Temporal Filter</label>
              <input 
                type="date" 
                className="fi h-10 w-44 bg-bg/50 border-border/20 text-xs font-mono rounded-xl px-4"
                value={filters.date} 
                onChange={e => setFilters(prev => ({ ...prev, date: e.target.value }))} 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Entity Reference</label>
              <input 
                type="text" 
                placeholder="PO Number..."
                className="fi h-10 w-44 bg-bg/50 border-border/20 text-xs font-mono rounded-xl px-4"
                value={filters.poNo} 
                onChange={e => setFilters(prev => ({ ...prev, poNo: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Buyer Node</label>
              <select 
                className="fi h-10 w-44 bg-bg/50 border-border/20 text-xs font-black rounded-xl px-4 cursor-pointer"
                value={filters.buyer} 
                onChange={e => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
              >
                <option value="">All Buyers</option>
                {uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground ml-1">Chroma Search</label>
              <input 
                type="text" 
                placeholder="Color Identification..." 
                className="fi h-10 w-44 bg-bg/50 border-border/20 text-xs rounded-xl px-4"
                value={filters.color}
                onChange={e => setFilters(prev => ({ ...prev, color: e.target.value }))}
              />
            </div>
            <button 
              className="h-10 w-10 bg-white/5 hover:bg-white/10 text-muted hover:text-fg rounded-xl flex items-center justify-center transition-all border border-border/20"
              onClick={() => setFilters({ date: '', poNo: '', buyer: '', color: '' })}
            >
              <X size={16} />
            </button>

            {selectedIds.length > 0 && hasPermission('delete-entry') && (
              <motion.button
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setBulkDeleteConfirm(true)}
                className="h-10 px-6 bg-danger/10 hover:bg-danger text-danger hover:text-slate-950 border border-danger/20 rounded-xl flex items-center gap-3 transition-all ml-auto text-[10px] font-black uppercase tracking-widest"
              >
                <Trash2 size={14} /> Purge Block ({selectedIds.length})
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Experience Grid (Table) */}
      <div className="flex-1 min-h-0 bg-card/10 border border-border/10 rounded-2xl overflow-hidden flex flex-col shadow-inner">
        <div className="overflow-x-auto overflow-y-auto no-scrollbar custom-scrollbar relative">
          <table className="w-full border-separate border-spacing-0 min-w-[2000px]">
            <thead className="sticky top-0 z-20 backdrop-blur-2xl bg-bg2/90">
              <tr>
                <th className="w-12 p-3 border-b border-border/20">
                  <input 
                    type="checkbox" 
                    className="accent-accent w-4 h-4 rounded cursor-pointer"
                    checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="w-12 p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted">ID</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Production Date</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">PO Reference</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Buyer</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Style Node</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Color Chromatics</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Floor Unit</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-left">Line Matrix</th>
                
                {/* Metrics */}
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3">CUT</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3">SEW</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3">WIP (S)</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3 text-accent">WASH</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3">WIP (W)</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3 text-accent-foreground">FIN IN</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3 text-accent-foreground">FIN OUT</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted-foreground bg-white/3">WIP (F)</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-success bg-white/3">POLY</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-info bg-info/5">SHIPMENT</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted">ACCURACY</th>
                <th className="p-3 border-b border-border/20 text-[9px] font-black uppercase tracking-widest text-muted text-center sticky right-0 bg-bg2/90">Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/5">
              {displayedEntries.map((e, i) => {
                const info = getPOInfo(e.poNo);
                const colorRow = info?.colorRows.find(r => r.color === e.color);
                const ach = colorRow?.orderQty ? Math.round(((e.poly || 0) / colorRow.orderQty) * 100 * 10) / 10 : 0;
                const isSelected = selectedIds.includes(String(e.id));
                
                return (
                  <tr 
                    key={e.id} 
                    className={cn(
                      "group hover:bg-white/[0.04] transition-colors",
                      e.violations && e.violations.length > 0 ? "bg-danger/[0.03]" : "",
                      isSelected ? "bg-accent/[0.05]" : ""
                    )}
                  >
                    <td className="p-3 text-center">
                       <input 
                         type="checkbox" 
                         className="accent-accent w-4 h-4 rounded cursor-pointer"
                         checked={isSelected}
                         onChange={() => toggleSelect(String(e.id))}
                       />
                    </td>
                    <td className="p-3 text-center num text-[9px] text-muted-foreground">{i + 1}</td>
                    <td className="p-3 font-mono text-[10px] text-muted-foreground">{safeFormat(e.date)}</td>
                    <td className="p-3 font-black text-accent text-[10px] tracking-widest">{e.poNo}</td>
                    <td className="p-3 font-black uppercase text-[10px] text-fg/80">{info?.buyer || '—'}</td>
                    <td className="p-3 font-mono text-[10px] opacity-60 italic">{info?.style || '—'}</td>
                    <td className="p-3">
                       <div className="flex items-center gap-2">
                          <div className={cn("w-2 h-2 rounded-full", e.color.toLowerCase().includes('white') ? "bg-white" : e.color.toLowerCase().includes('black') ? "bg-slate-900 border border-white/20" : "bg-accent")} />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">{e.color}</span>
                       </div>
                    </td>
                    <td className="p-3 text-[10px] font-black text-success/70 uppercase">{e.floor || '—'}</td>
                    <td className="p-3 text-[10px] font-black text-accent/70 uppercase font-mono">{e.lineNo || '—'}</td>
                    
                    <td className="p-3 num text-[11px] font-black bg-white/[0.01] opacity-60">{(e.cut || 0).toLocaleString()}</td>
                    <td className="p-3 num text-[11px] font-black bg-white/[0.01] opacity-60">{(e.sewOut || 0).toLocaleString()}</td>
                    <td className="p-3 num bg-white/[0.01]">
                       <span className={getWIPClass((wipMap[`${e.poNo}-${e.color}`]?.cut || 0) - (wipMap[`${e.poNo}-${e.color}`]?.sewOut || 0))}>
                        {((wipMap[`${e.poNo}-${e.color}`]?.cut || 0) - (wipMap[`${e.poNo}-${e.color}`]?.sewOut || 0)).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 num text-[11px] font-black bg-white/[0.01] text-accent">{(e.washR || 0).toLocaleString()}</td>
                    <td className="p-3 num bg-white/[0.01]">
                       <span className={getWIPClass((wipMap[`${e.poNo}-${e.color}`]?.sewOut || 0) - (wipMap[`${e.poNo}-${e.color}`]?.washR || 0))}>
                        {((wipMap[`${e.poNo}-${e.color}`]?.sewOut || 0) - (wipMap[`${e.poNo}-${e.color}`]?.washR || 0)).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 num text-[11px] font-black bg-white/[0.01] opacity-80">{(e.finIn || 0).toLocaleString()}</td>
                    <td className="p-3 num text-[11px] font-black bg-white/[0.01] opacity-80">{(e.finOut || 0).toLocaleString()}</td>
                    <td className="p-3 num bg-white/[0.01]">
                       <span className={getWIPClass((wipMap[`${e.poNo}-${e.color}`]?.finIn || 0) - (wipMap[`${e.poNo}-${e.color}`]?.finOut || 0))}>
                        {((wipMap[`${e.poNo}-${e.color}`]?.finIn || 0) - (wipMap[`${e.poNo}-${e.color}`]?.finOut || 0)).toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3 num text-[11px] font-black text-success bg-success/5 border-l border-success/10 group-hover:bg-success/10 transition-colors">{(e.poly || 0).toLocaleString()}</td>
                    <td className="p-3 num text-[11px] font-black text-info bg-info/5 border-l border-info/10 group-hover:bg-info/10 transition-colors">{(e.shipment || 0).toLocaleString()}</td>
                    <td className="p-3 text-center">
                       <div className="flex flex-col items-center gap-1">
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden max-w-[50px]">
                             <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(ach, 100)}%` }} className={cn("h-full", ach >= 80 ? "bg-success" : ach >= 50 ? "bg-accent" : "bg-danger")} />
                          </div>
                          <span className={cn("text-[9px] font-black italic", ach >= 80 ? "text-success" : ach >= 50 ? "text-accent" : "text-danger")}>{ach}%</span>
                       </div>
                    </td>
                    <td className="p-3 text-center sticky right-0 bg-bg backdrop-blur-md border-l border-border/10">
                       <div className="flex items-center justify-center gap-1">
                          <button onClick={() => editEntry(e)} className="w-7 h-7 bg-bg2/80 rounded-lg flex items-center justify-center text-muted hover:text-accent hover:bg-accent/10 transition-all">
                             <Pencil size={12} />
                          </button>
                          <button onClick={() => setDeleteConfirmId(e.id)} className="w-7 h-7 bg-bg2/80 rounded-lg flex items-center justify-center text-muted hover:text-danger hover:bg-danger/10 transition-all">
                             <Trash2 size={12} />
                          </button>
                       </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length > displayLimit && (
                <tr>
                   <td colSpan={21} className="p-6 text-center">
                      <button 
                         onClick={() => setDisplayLimit(prev => prev + 200)}
                         className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-muted hover:text-fg hover:bg-white/10 transition-all"
                      >
                         Load More Data Stream ({filteredEntries.length - displayLimit} Remaining)
                      </button>
                   </td>
                </tr>
              )}
              {filteredEntries.length === 0 && (
                <tr>
                   <td colSpan={21} className="py-32 text-center">
                      <div className="flex flex-col items-center gap-3 opacity-20">
                         <div className="w-20 h-20 border-2 border-dashed border-fg rounded-3xl flex items-center justify-center">
                            <Database size={40} />
                         </div>
                         <h3 className="text-sm font-black uppercase tracking-[0.3em]">No Data Streams Found</h3>
                         <p className="text-[10px] font-black uppercase tracking-widest text-muted">Initialize node entry to begin processing</p>
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Modal (The New Entry Form) */}
      <AnimatePresence>
        {(isFormOpen || editingEntryId) && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-hidden">
            <motion.div 
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeForm}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              key="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl h-[90vh] bg-bg2 border border-border/20 rounded-3xl shadow-3xl flex flex-col overflow-hidden m-4"
            >
              <div className="p-6 border-b border-border/20 flex items-center justify-between bg-bg/40 backdrop-blur-xl">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-accent/20 rounded-2xl flex items-center justify-center text-accent shadow-lg border border-accent/30">
                       {editingEntryId ? <Pencil size={24} /> : <Plus size={24} />}
                    </div>
                    <div>
                       <h3 className="text-xl font-black uppercase tracking-tight leading-none">
                          {editingEntryId ? 'Protocol Modification' : 'Node Initialization'}
                       </h3>
                       <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-1">Data Stream Integration Interface</p>
                    </div>
                 </div>
                 <button onClick={closeForm} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-muted hover:text-fg transition-all">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* Live Production Status Overview */}
                {formData.poNo && formData.color && poInfo && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-bg/50 border border-white/5 rounded-2xl shadow-inner relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                       <TrendingUp size={80} />
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted uppercase tracking-widest">Buyer Node</span>
                      <span className="text-xs font-black uppercase text-accent">{poInfo.buyer}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted uppercase tracking-widest">Order Capacity</span>
                      <span className="text-xs font-black font-mono">{(selectedColorRow?.orderQty || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted uppercase tracking-widest">Achieved Quant</span>
                      <span className="text-xs font-black font-mono text-success">{cumulativeStats.poly.toLocaleString()}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] font-black text-muted uppercase tracking-widest">Efficiency</span>
                      <span className="text-xs font-black font-mono text-info">{achievement}%</span>
                    </div>
                  </motion.div>
                )}

                <form onSubmit={saveEntry} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="flex flex-col gap-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Temporal Anchor (Date)</label>
                        <input 
                          type="date" 
                          name="date"
                          value={formData.date} 
                          onChange={handleInputChange} 
                          className="fi h-12 bg-bg border-border/20 text-xs font-mono font-black rounded-2xl px-5 focus:ring-2 focus:ring-accent/20 transition-all"
                          required 
                        />
                     </div>
                     <div className="flex flex-col gap-2 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Universal PO Identifier</label>
                        <div className="relative group">
                          <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted/30 group-focus-within:text-accent transition-colors" />
                          <input 
                            list="po-list-modal" 
                            name="poNo" 
                            value={formData.poNo} 
                            onChange={handleInputChange} 
                            className="fi h-12 bg-bg border-border/20 text-sm font-black rounded-2xl pl-12 pr-5 focus:ring-2 focus:ring-accent/20 transition-all font-mono"
                            placeholder="Enter PO ID Node..."
                            required 
                          />
                          <datalist id="po-list-modal">
                            {uniquePOs.map(po => {
                              const info = getPOInfo(po);
                              return <option key={po} value={po}>{info?.buyer} / {info?.style}</option>;
                            })}
                          </datalist>
                        </div>
                     </div>
                  </div>

                  <AnimatePresence>
                    {formData.poNo && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-border/10"
                      >
                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Buyer Spectrum</label>
                            <div className="h-12 bg-accent/5 border border-accent/20 rounded-2xl flex items-center px-5 text-[11px] font-black text-accent uppercase tracking-widest">
                               {poInfo?.buyer || 'IDENTITY NOT FOUND'}
                            </div>
                         </div>
                         <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Selection Chromatics (Color)</label>
                            <select 
                              name="color" 
                              value={formData.color} 
                              onChange={handleInputChange} 
                              className="fi h-12 bg-bg border-border/20 text-xs font-black rounded-2xl px-5 cursor-pointer"
                              required
                            >
                              <option value="">-- Choose Spectral Value --</option>
                              {poInfo?.colors.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                         </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="h-px bg-border/10 my-8" />

                  {formData.poNo && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mb-8 p-6 bg-accent/5 border border-accent/10 rounded-[32px] overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center text-accent ring-1 ring-accent/20">
                            <Activity size={24} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-accent uppercase tracking-widest">LIVE DATA ANCHOR</p>
                            <h4 className="text-sm font-black uppercase text-fg leading-none mt-1">
                              {poInfo?.buyer || 'PENDING'} | {formData.poNo} {formData.color ? `| ${formData.color}` : ''}
                            </h4>
                          </div>
                        </div>

                        {formData.color ? (
                          <div className="flex items-center gap-8">
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-muted uppercase tracking-widest">TOTAL ORDER</span>
                              <span className="text-lg font-black num text-fg">{(selectedColorRow?.orderQty || 0).toLocaleString()}</span>
                            </div>
                            <div className="w-px h-10 bg-border/20" />
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-muted uppercase tracking-widest">TOTAL ACHIEVED (POLY)</span>
                              <span className="text-lg font-black num text-success">{(cumulativeStats.poly || 0).toLocaleString()}</span>
                            </div>
                            <div className="w-px h-10 bg-border/20" />
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-muted uppercase tracking-widest">REMAINING</span>
                              <span className="text-lg font-black num text-danger">
                                {Math.max(0, (selectedColorRow?.orderQty || 0) - cumulativeStats.poly).toLocaleString()}
                              </span>
                            </div>
                            <div className="w-px h-10 bg-border/20" />
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] font-black text-muted uppercase tracking-widest">EFFICIENCY</span>
                              <span className="text-lg font-black num text-accent">{achievement}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px] font-black text-muted uppercase tracking-[0.2em] animate-pulse">
                            Waiting for Spectral Color Assignment...
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: 'Cutting Node', name: 'cut', theme: 'muted' },
                      { label: 'Sewing Node', name: 'sewOut', theme: 'muted' },
                      { label: 'Wash Node', name: 'washR', theme: 'accent' },
                      { label: 'Fin Inbound', name: 'finIn', theme: 'accent' },
                      { label: 'Fin Outbound', name: 'finOut', theme: 'accent' },
                      { label: 'Poly Matrix', name: 'poly', theme: 'success' },
                      { label: 'Final Shipment', name: 'shipment', theme: 'info' },
                    ].map(field => (
                      <div key={field.name} className="flex flex-col gap-2">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest ml-1 opacity-70", `text-${field.theme}`)}>{field.label}</label>
                        <input 
                          type="number" 
                          name={field.name}
                          value={formData[field.name as keyof typeof formData] || ''} 
                          onChange={handleInputChange} 
                          className={cn("fi h-12 bg-bg text-center text-sm font-black num rounded-2xl border-border/20 focus:ring-2 transition-all", `focus:ring-${field.theme}/20`)}
                          min="0" 
                        />
                      </div>
                    ))}
                    <div className="flex flex-col gap-2">
                        <label className="text-[9px] font-black uppercase tracking-widest ml-1 text-accent opacity-70">Node Line ID</label>
                        <input 
                          type="text" 
                          name="lineNo"
                          value={formData.lineNo} 
                          onChange={handleInputChange} 
                          className="fi h-12 bg-bg text-center text-xs font-black rounded-2xl border-border/20 focus:ring-2 focus:ring-accent/20 transition-all font-mono"
                          placeholder="LINE-00"
                        />
                    </div>
                  </div>

                  {formData.poNo && (
                     <div className="mt-8 flex items-center justify-center">
                        <div className="px-6 py-2 bg-bg border border-border/20 rounded-full flex items-center gap-4 shadow-inner">
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-muted uppercase tracking-widest">Selected Matrix:</span>
                              <span className="text-[10px] font-black text-accent uppercase">{poInfo?.buyer || '...'} / {formData.poNo} {formData.color ? `/ ${formData.color}` : ''}</span>
                           </div>
                           {formData.color && (
                             <>
                               <div className="h-4 w-px bg-border/20" />
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">Achieved:</span>
                                  <span className="text-[10px] font-black text-success num">{achievement}%</span>
                               </div>
                               <div className="h-4 w-px bg-border/20" />
                               <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black text-muted uppercase tracking-widest">Balance:</span>
                                  <span className="text-[10px] font-black text-danger num">{Math.max(0, (selectedColorRow?.orderQty || 0) - cumulativeStats.poly).toLocaleString()}</span>
                               </div>
                             </>
                           )}
                        </div>
                     </div>
                  )}

                  <div className="pt-10 flex gap-4">
                     <button type="submit" className="flex-1 h-16 bg-accent text-slate-950 rounded-2xl shadow-xl shadow-accent/20 flex items-center justify-center gap-3 text-xs font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all" disabled={loading}>
                        <Save size={20} />
                        {loading ? 'Processing Stream...' : (editingEntryId ? 'Commit Changes' : 'Initialize Node')}
                     </button>
                     <button type="button" onClick={clearForm} className="w-16 h-16 bg-white/5 border border-border/20 rounded-2xl flex items-center justify-center text-muted hover:text-fg hover:bg-white/10 transition-all">
                        <Eraser size={24} />
                     </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="h-6" /> {/* Spacer for FAB */}

      {/* Collect from Excel Modal */}
      <AnimatePresence>
        {isCollectModalOpen && (
          <CollectFromExcelModal 
            type="entries"
            orders={orders}
            entries={entries}
            onClose={() => setIsCollectModalOpen(false)}
            onPushToForm={(data) => {
              setFormData(prev => ({
                ...prev,
                ...data
              }));
              addToast('Target Locked: Data synced to local matrix', 'ok');
            }}
            onSuccess={(count) => {
              addToast(`Sync Protocol Synchronized: ${count} entities migrated`, 'ok');
              setIsCollectModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 overflow-y-auto no-scrollbar">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative bg-card border border-border/40 rounded-[2rem] shadow-3xl p-8 max-w-sm w-full text-center z-50 my-auto"
            >
              <Trash2 size={40} className="mx-auto text-danger mb-4" />
              <h3 className="text-lg font-bold mb-2">Confirm Delete</h3>
              <p className="text-sm text-muted mb-6">Are you sure you want to delete this production entry? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="btn btn-o flex-1">Cancel</button>
                <button onClick={confirmDelete} className="btn btn-d flex-1">Delete</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkDeleteConfirm && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 overflow-y-auto no-scrollbar">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteConfirm(false)}
              className="fixed inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative bg-card border border-border/40 rounded-[2rem] shadow-3xl p-8 max-w-sm w-full text-center z-50 my-auto"
            >
              <Trash2 size={40} className="mx-auto text-danger mb-4" />
              <h3 className="text-lg font-bold mb-2">Confirm Bulk Delete</h3>
              <p className="text-sm text-muted mb-6">Are you sure you want to delete <span className="text-danger font-bold">{selectedIds.length}</span> production entries? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setBulkDeleteConfirm(false)} className="btn btn-o flex-1">Cancel</button>
                <button onClick={handleBulkDelete} className="btn btn-d flex-1" disabled={loading}>
                  {loading ? 'Deleting...' : 'Delete All Selected'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
