import React, { useState, useMemo } from 'react';
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
import { db, addAuditLog } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';

interface DataEntryProps {
  orders: Order[];
  entries: ProductionEntry[];
  getPOInfo: (poNo: string) => POInfo | null;
  addToast: (msg: string, type?: 'ok' | 'er' | 'in') => void;
  userProfile: { role: string; permissions?: string[] } | null;
}

export default function DataEntry({ orders, entries, getPOInfo, addToast, userProfile }: DataEntryProps) {
  const [formData, setFormData] = useState({
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

  const hasPermission = (p: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const [editingEntryId, setEditingEntryId] = useState<string | number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

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

    // Validation Logic
    const poEntries = entries.filter(e => e.poNo === formData.poNo && e.color === formData.color && e.id !== editingEntryId);
    const cumCut = poEntries.reduce((s, e) => s + (e.cut || 0), 0) + formData.cut;
    const cumSewOut = poEntries.reduce((s, e) => s + (e.sewOut || 0), 0) + formData.sewOut;
    const cumWashR = poEntries.reduce((s, e) => s + (e.washR || 0), 0) + formData.washR;
    const cumFinIn = poEntries.reduce((s, e) => s + (e.finIn || 0), 0) + formData.finIn;
    const cumFinOut = poEntries.reduce((s, e) => s + (e.finOut || 0), 0) + formData.finOut;
    const cumPoly = poEntries.reduce((s, e) => s + (e.poly || 0), 0) + formData.poly;
    const cumShipment = poEntries.reduce((s, e) => s + (e.shipment || 0), 0) + formData.shipment;
    const orderQty = selectedColorRow?.orderQty || 0;

    const violations: string[] = [];
    if (cumSewOut > cumCut) violations.push('Sewing > Cutting');
    if (cumWashR > cumSewOut) violations.push('Wash > Sewing');
    if (cumFinIn > cumWashR) violations.push('Fin Input > Wash');
    if (cumFinOut > cumFinIn) violations.push('Fin Output > Fin Input');
    if (cumPoly > orderQty) violations.push('Poly > Order Qty');
    if (cumShipment > cumPoly) violations.push('Shipment > Poly');

    if (violations.length > 0) {
      addToast(`Rule Violation: ${violations.join(', ')}`, 'er');
    }

    setLoading(true);
    try {
      if (editingEntryId !== null) {
        await updateDoc(doc(db, 'entries', String(editingEntryId)), { ...formData, violations });
        
        await addAuditLog(
          'EDIT', 
          'ENTRY', 
          `Updated Entry: PO ${formData.poNo}, Date ${formData.date}`,
          `/entries/${editingEntryId}`
        );

        addToast('Entry updated successfully', 'ok');
      } else {
        // Conditional Mandatory Validation
        if (formData.poly > 0 && !formData.floor.trim()) {
          addToast('Floor is mandatory for Poly Entry', 'er');
          setLoading(false);
          return;
        }
        if ((formData.finIn > 0 || formData.finOut > 0) && !formData.lineNo.trim()) {
          addToast('Line No is mandatory for Finishing Input/Output', 'er');
          setLoading(false);
          return;
        }

        const docRef = await addDoc(collection(db, 'entries'), { ...formData, violations });
        
        await addAuditLog(
          'ADD', 
          'ENTRY', 
          `Added New Entry: PO ${formData.poNo}, Date ${formData.date}`,
          `/entries/${docRef.id}`
        );

        addToast('Entry saved successfully', 'ok');
      }
      clearForm();
    } catch (err) {
      addToast('Failed to save entry', 'er');
    } finally {
      setLoading(false);
    }
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

  const uniquePOs = Array.from(new Set(orders.map(o => o.poNo)));
  const uniqueBuyers = Array.from(new Set(orders.map(o => o.buyer)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Keyboard size={20} className="text-accent" />
            Daily Production Entry
          </h2>
          <p className="text-[11px] text-muted">Enter daily output for cutting, sewing, washing, and finishing</p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted bg-card px-3 py-1.5 rounded-md border border-border">
          <Activity size={12} className="text-info" />
          <span className="num">{entries.length}</span> total entries
        </div>
      </div>

      {/* Entry Form */}
      {hasPermission('add-entry') || hasPermission('edit-entry') ? (
        <div className={cn(
          "bg-card border rounded-xl p-3 shadow-xl pdf-exclude-form transition-all max-w-5xl",
          editingEntryId ? "border-accent ring-1 ring-accent/20" : "border-border"
        )}>
          <form onSubmit={saveEntry} className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold flex items-center gap-2">
                {editingEntryId ? <TrendingUp size={14} className="text-accent" /> : <Plus size={14} className="text-accent" />}
                {editingEntryId ? 'Edit Production Entry' : 'New Production Entry'}
              </h3>
              {editingEntryId && (
                <button type="button" onClick={clearForm} className="text-[10px] text-accent hover:underline flex items-center gap-1">
                  <X size={10} /> Cancel
                </button>
              )}
            </div>

            {/* Line 1: Date, PO, Color, Buyer, Style */}
            <div className="grid grid-cols-5 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted uppercase px-1 leading-none mb-1.5">Date *</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="fi h-8 text-xs px-2" required />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted uppercase px-1 leading-none mb-1.5">PO *</label>
                <input list="po-list" name="poNo" value={formData.poNo} onChange={handleInputChange} className="fi h-8 text-xs px-2" placeholder="PO#" required />
                <datalist id="po-list">
                  {uniquePOs.map(po => {
                    const info = getPOInfo(po);
                    return <option key={po} value={po}>{info?.buyer} / {info?.style}</option>;
                  })}
                </datalist>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted uppercase px-1 leading-none mb-1.5">Color *</label>
                <select name="color" value={formData.color} onChange={handleInputChange} className="fi h-8 text-xs px-1" required disabled={!formData.poNo}>
                  <option value="">-- Color --</option>
                  {poInfo?.colors.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted uppercase px-1 leading-none mb-1.5 text-accent">Buyer</label>
                <input type="text" value={poInfo?.buyer || ''} readOnly className="fi h-8 text-xs bg-accent/5 text-accent font-bold px-2" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-muted uppercase px-1 leading-none mb-1.5 text-accent">Style</label>
                <input type="text" value={poInfo?.style || ''} readOnly className="fi h-8 text-xs bg-accent/5 text-accent font-bold px-2" />
              </div>
            </div>

            {/* Line 2: Line No., Finishing input, Finishing Output */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-accent uppercase px-1 leading-none mb-1.5">Line No</label>
                <input type="text" name="lineNo" value={formData.lineNo} onChange={handleInputChange} className={cn("fi h-8 text-xs px-2", (formData.finIn > 0 || formData.finOut > 0) && !formData.lineNo && "border-danger ring-1 ring-danger/20")} placeholder="Line #" />
              </div>
              {[
                { label: 'Finishing Input', name: 'finIn', key: 'finIn' },
                { label: 'Finishing Output', name: 'finOut', key: 'finOut' },
              ].map(field => (
                <div key={field.name} className="flex flex-col">
                  <div className="flex justify-between items-center px-1 mb-1">
                    <label className="text-[10px] font-bold text-accent uppercase leading-none">{field.label}</label>
                    <span className="text-[9px] text-muted-foreground font-mono font-bold">{(cumulativeStats[field.key as keyof typeof cumulativeStats] || 0).toLocaleString()} / {(selectedColorRow?.orderQty || 0).toLocaleString() || '0'}</span>
                  </div>
                  <input type="number" name={field.name} value={formData[field.name as keyof typeof formData] || ''} onChange={handleInputChange} className="fi h-8 text-xs text-center font-mono border-accent/30" min="0" />
                </div>
              ))}
            </div>

            {/* Line 3: Floor (Select), Poly Entry, Shipment Qty, Achievement % */}
            <div className="grid grid-cols-4 gap-3">
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-success uppercase px-1 leading-none mb-1.5">Floor</label>
                <select name="floor" value={formData.floor} onChange={handleInputChange} className={cn("fi h-8 text-xs border-success/30 px-1", formData.poly > 0 && !formData.floor && "border-danger ring-1 ring-danger/20")}>
                  <option value="">-- Floor --</option>
                  <option value="Woven">Woven</option>
                  <option value="Knit">Knit</option>
                </select>
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center px-1 mb-1">
                  <label className="text-[10px] font-bold text-success uppercase leading-none">Poly Entry</label>
                  <span className="text-[9px] text-muted-foreground font-mono font-bold">{(cumulativeStats.poly || 0).toLocaleString()} / {(selectedColorRow?.orderQty || 0).toLocaleString() || '0'}</span>
                </div>
                <input type="number" name="poly" value={formData.poly || ''} onChange={handleInputChange} className="fi h-8 text-xs text-center font-mono border-success/30" min="0" />
              </div>
              <div className="flex flex-col">
                <div className="flex justify-between items-center px-1 mb-1">
                  <label className="text-[10px] font-bold text-info uppercase leading-none">Shipment Qty</label>
                  <span className="text-[9px] text-muted-foreground font-mono font-bold">{(cumulativeStats.shipment || 0).toLocaleString()} / {(cumulativeStats.poly || 0).toLocaleString()}</span>
                </div>
                <input type="number" name="shipment" value={formData.shipment || ''} onChange={handleInputChange} className="fi h-8 text-xs text-center font-mono border-info/30" min="0" />
              </div>
              <div className="flex flex-col">
                <label className="text-[10px] font-bold text-success uppercase px-1 leading-none mb-1.5">Achievement %</label>
                <div className="fi h-8 text-xs bg-success/10 text-success font-mono font-bold text-center flex items-center justify-center border-success/30">
                  {achievement}%
                </div>
              </div>
            </div>

            {/* Line 4: Cutting Qty, Sewing Qty, Wash received, Save Production Entry, Clear Form */}
            <div className="grid grid-cols-5 gap-3 items-end">
              {[
                { label: 'Cutting Qty', name: 'cut', key: 'cut' },
                { label: 'Sewing Output', name: 'sewOut', key: 'sewOut' },
                { label: 'Wash Received', name: 'washR', key: 'washR' },
              ].map(field => (
                <div key={field.name} className="flex flex-col">
                  <div className="flex justify-between items-center px-1 mb-1">
                    <label className="text-[10px] font-bold text-muted uppercase leading-none">{field.label}</label>
                    <span className="text-[9px] text-muted-foreground font-mono font-bold">{(cumulativeStats[field.key as keyof typeof cumulativeStats] || 0).toLocaleString()} / {(selectedColorRow?.orderQty || 0).toLocaleString() || '0'}</span>
                  </div>
                  <input type="number" name={field.name} value={formData[field.name as keyof typeof formData] || ''} onChange={handleInputChange} className="fi h-8 text-xs text-center font-mono" min="0" />
                </div>
              ))}
              <button type="submit" className="btn btn-p btn-s flex items-center justify-center gap-1.5 h-8 text-[11px] px-3 font-bold">
                <Save size={14} /> Save
              </button>
              <button type="button" onClick={clearForm} className="btn btn-o btn-s flex items-center justify-center gap-1.5 h-8 text-[11px] px-3 font-bold">
                <Eraser size={14} /> Clear
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-8 text-center">
          <AlertTriangle size={32} className="mx-auto text-accent mb-3 opacity-50" />
          <h3 className="text-sm font-bold text-fg mb-1">View Only Mode</h3>
          <p className="text-xs text-muted">You do not have permission to add or edit production entries.</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-3 flex flex-wrap gap-3 items-center shadow-md">
        <div className="flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
          <Filter size={14} className="text-accent" />
          Filter Entries:
        </div>
        <input 
          type="date" 
          className="fi w-auto" 
          value={filters.date} 
          onChange={e => setFilters(prev => ({ ...prev, date: e.target.value }))} 
        />
        <select 
          className="fi w-auto" 
          value={filters.poNo} 
          onChange={e => setFilters(prev => ({ ...prev, poNo: e.target.value }))}
        >
          <option value="">All POs</option>
          {uniquePOs.map(po => <option key={po} value={po}>{po}</option>)}
        </select>
        <select 
          className="fi w-auto" 
          value={filters.buyer} 
          onChange={e => setFilters(prev => ({ ...prev, buyer: e.target.value }))}
        >
          <option value="">All Buyers</option>
          {uniqueBuyers.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <input 
          type="text" 
          placeholder="Color..." 
          className="fi w-32" 
          value={filters.color}
          onChange={e => setFilters(prev => ({ ...prev, color: e.target.value }))}
        />
        <button 
          className="btn btn-o btn-s" 
          onClick={() => setFilters({ date: '', poNo: '', buyer: '', color: '' })}
        >
          <X size={12} /> Reset
        </button>

        {selectedIds.length > 0 && hasPermission('delete-entry') && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setBulkDeleteConfirm(true)}
            className="btn btn-d btn-s gap-2 ml-auto"
          >
            <Trash2 size={12} /> Delete Selected ({selectedIds.length})
          </motion.button>
        )}
      </div>

      {/* Entries Table */}
      <div className="border border-border rounded-lg overflow-hidden shadow-2xl">
        <div className="overflow-x-auto max-h-[45vh]">
          <table className="et">
            <thead>
              <tr>
                <th className="w-10">
                  <input 
                    type="checkbox" 
                    className="accent-accent"
                    checked={selectedIds.length === filteredEntries.length && filteredEntries.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="w-10">#</th>
                <th>Date</th>
                <th>PO No</th>
                <th>Buyer</th>
                <th>Style</th>
                <th>Color</th>
                <th>Line No</th>
                <th>Floor</th>
                <th>Cutting</th>
                <th>Sew Out</th>
                <th>Wash Recv</th>
                <th>Fin In</th>
                <th>Fin Out</th>
                <th>Poly</th>
                <th>Shipment</th>
                <th>Ach%</th>
                <th>Act</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e, i) => {
                const info = getPOInfo(e.poNo);
                const colorRow = info?.colorRows.find(r => r.color === e.color);
                const ach = colorRow?.orderQty ? Math.round(((e.poly || 0) / colorRow.orderQty) * 100 * 10) / 10 : 0;
                return (
                  <tr key={e.id} className={cn(e.violations && e.violations.length > 0 ? "bg-danger/5" : "", selectedIds.includes(String(e.id)) ? "bg-accent/10" : "")}>
                    <td>
                      <input 
                        type="checkbox" 
                        className="accent-accent"
                        checked={selectedIds.includes(String(e.id))}
                        onChange={() => toggleSelect(String(e.id))}
                      />
                    </td>
                    <td className="num text-muted">
                      {e.violations && e.violations.length > 0 ? (
                        <div className="group relative flex justify-center">
                          <AlertTriangle size={12} className="text-danger" />
                          <div className="absolute bottom-full mb-2 hidden group-hover:block z-50 bg-danger text-white text-[9px] p-1.5 rounded shadow-lg whitespace-nowrap">
                            {e.violations.join(', ')}
                          </div>
                        </div>
                      ) : i + 1}
                    </td>
                    <td className="whitespace-nowrap">{safeFormat(e.date)}</td>
                    <td className="font-mono text-accent font-bold text-[10px]">{e.poNo}</td>
                    <td className="font-semibold">{info?.buyer || '—'}</td>
                    <td className="font-mono text-[10px]">{info?.style || '—'}</td>
                    <td className="text-[11px]">{e.color}</td>
                    <td className="text-[11px] text-accent font-bold">{e.lineNo || '—'}</td>
                    <td className="text-[11px] text-success font-bold">{e.floor || '—'}</td>
                    <td className="num">{(e.cut || 0).toLocaleString()}</td>
                    <td className="num">{(e.sewOut || 0).toLocaleString()}</td>
                    <td className="num">{(e.washR || 0).toLocaleString()}</td>
                    <td className="num">{(e.finIn || 0).toLocaleString()}</td>
                    <td className="num">{(e.finOut || 0).toLocaleString()}</td>
                    <td className="num text-success font-bold">{(e.poly || 0).toLocaleString()}</td>
                    <td className="num text-info font-bold">{(e.shipment || 0).toLocaleString()}</td>
                    <td className="num">
                      <span className={cn(
                        "font-bold",
                        ach >= 80 ? "text-success" : ach >= 50 ? "text-accent" : "text-danger"
                      )}>
                        {ach}%
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-center">
                        {hasPermission('edit-entry') && (
                          <button className="btn btn-o btn-s" onClick={() => editEntry(e)}>
                            <Pencil size={12} />
                          </button>
                        )}
                        {hasPermission('delete-entry') && (
                          <button className="btn btn-d btn-s" onClick={() => setDeleteConfirmId(e.id)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                        {!hasPermission('edit-entry') && !hasPermission('delete-entry') && (
                          <span className="text-[10px] text-muted italic">View Only</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={15} className="py-20 text-center text-muted">
                    <Keyboard size={40} className="mx-auto mb-2 opacity-20" />
                    No production entries found for the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full text-center"
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
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBulkDeleteConfirm(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full text-center"
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
}
