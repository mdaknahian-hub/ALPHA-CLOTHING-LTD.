import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Database, Layers, X, Save, Search, FileUp, AlertCircle, CheckCircle2, History as HistoryIcon, ChevronUp, ChevronDown, ChevronsUpDown, Minus } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry } from '../types';
import { BUYERS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, parse, isValid } from 'date-fns';
import { db, addAuditLog } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import HistoricalImportModal from './HistoricalImportModal';
import CollectFromExcelModal from './CollectFromExcelModal';

interface OrderMasterProps {
  orders: Order[];
  addToast: (msg: string, type?: 'ok' | 'er' | 'in') => void;
  userProfile: { role: string; permissions?: string[] } | null;
}

export default React.memo(function OrderMaster({ orders, addToast, userProfile }: OrderMasterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [isCollectModalOpen, setIsCollectModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Order; direction: 'asc' | 'desc' } | null>({ key: 'poNo', direction: 'desc' });

  const [bulkUpdateData, setBulkUpdateData] = useState({
    buyer: '',
    style: ''
  });

  const hasPermission = (p: string) => {
    if (!userProfile) return false;
    if (userProfile.role === 'admin') return true;
    return userProfile.permissions?.includes(p) || false;
  };

  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase();
    let result = orders
      .filter(o => 
        o.poNo.toLowerCase().includes(s) || 
        o.buyer.toLowerCase().includes(s) || 
        o.style.toLowerCase().includes(s)
      );

    if (sortConfig) {
      result = [...result].sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default hierarchical sort (Buyer > Style > PO > Color)
      result.sort((a, b) => {
        const buyerCmp = (a.buyer || '').localeCompare(b.buyer || '');
        if (buyerCmp !== 0) return buyerCmp;
        const styleCmp = (a.style || '').localeCompare(b.style || '');
        if (styleCmp !== 0) return styleCmp;
        const poCmp = (a.poNo || '').localeCompare(b.poNo || '');
        if (poCmp !== 0) return poCmp;
        return (a.color || '').localeCompare(b.color || '');
      });
    }

    return result;
  }, [orders, search, sortConfig]);

  const handleSort = (key: keyof Order) => {
    setSortConfig(prev => {
      // If we are clearing sort or changing key, we stick to the default multi-level logic
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null;
      }
      return { key, direction: 'asc' };
    });
  };

  const getSortIcon = (key: keyof Order) => {
    if (sortConfig?.key !== key) return <ChevronsUpDown size={12} className="opacity-30" />;
    return sortConfig.direction === 'asc' ? 
      <ChevronUp size={12} className="text-accent" /> : 
      <ChevronDown size={12} className="text-accent" />;
  };

  const [formData, setFormData] = useState({
    buyer: '',
    style: '',
    poNo: '',
    shipDate: '',
    items: [{ color: '', orderQty: 0 }]
  });

  const openModal = (order: Order | null = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        buyer: order.buyer || '',
        style: order.style || '',
        poNo: order.poNo || '',
        shipDate: order.shipDate || '',
        items: [{ color: order.color || '', orderQty: order.orderQty || 0 }]
      });
    } else {
      setEditingOrder(null);
      setFormData({
        buyer: '',
        style: '',
        poNo: '',
        shipDate: format(new Date(), 'yyyy-MM-dd'),
        items: [{ color: '', orderQty: 0 }]
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingOrder(null);
    setIsModalOpen(false);
  };

  const handleDeleteClick = (id: string | number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      setLoading(true);
      try {
        const orderToDelete = orders.find(o => o.id === deleteConfirmId);
        await deleteDoc(doc(db, 'orders', String(deleteConfirmId)));
        
        await addAuditLog(
          'DELETE', 
          'ORDER', 
          `Deleted Order: PO ${orderToDelete?.poNo}, Color ${orderToDelete?.color}`,
          `/orders/${deleteConfirmId}`
        );

        addToast('Order deleted', 'in');
        setDeleteConfirmId(null);
        // Remove from selection if it was selected
        setSelectedIds(prev => {
          const next = new Set(prev);
          next.delete(deleteConfirmId);
          return next;
        });
      } catch (err) {
        addToast('Failed to delete order', 'er');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelect = (id: string | number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const idsArray = Array.from(selectedIds);
      
      idsArray.forEach(id => {
        batch.delete(doc(db, 'orders', String(id)));
      });

      await batch.commit();

      await addAuditLog(
        'DELETE',
        'ORDER',
        `Bulk Deleted ${selectedIds.size} Orders`,
        '/orders'
      );

      addToast(`${selectedIds.size} orders deleted`, 'in');
      setSelectedIds(new Set());
      setIsBulkDeleteConfirmOpen(false);
    } catch (err) {
      addToast('Failed to delete orders', 'er');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.size === 0) return;
    if (!bulkUpdateData.buyer && !bulkUpdateData.style) {
      addToast('Please provide at least one field to update', 'er');
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const idsArray = Array.from(selectedIds);
      
      const updateObj: any = {};
      if (bulkUpdateData.buyer) updateObj.buyer = bulkUpdateData.buyer;
      if (bulkUpdateData.style) updateObj.style = bulkUpdateData.style;

      idsArray.forEach(id => {
        batch.update(doc(db, 'orders', String(id)), updateObj);
      });

      await batch.commit();

      await addAuditLog(
        'EDIT',
        'ORDER',
        `Bulk Updated ${selectedIds.size} Orders (${Object.keys(updateObj).join(', ')})`,
        '/orders'
      );

      addToast(`${selectedIds.size} orders updated successfully`, 'ok');
      setSelectedIds(new Set());
      setIsBulkUpdateModalOpen(false);
      setBulkUpdateData({ buyer: '', style: '' });
    } catch (err) {
      addToast('Failed to update orders', 'er');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleItemChange = (index: number, field: 'color' | 'orderQty', value: string | number) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]: field === 'orderQty' ? (value === '' ? 0 : Number(value)) : value
      };
      return { ...prev, items: newItems };
    });
  };

  const addRow = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { color: '', orderQty: 0 }]
    }));
  };

  const removeRow = (index: number) => {
    if (formData.items.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.buyer || !formData.style || !formData.poNo || !formData.shipDate) {
      addToast('Please fill all required fields', 'er');
      return;
    }

    const invalidItems = formData.items.some(item => !item.color.trim() || item.orderQty <= 0);
    if (invalidItems) {
      addToast('Please provide valid color and quantity for all items', 'er');
      return;
    }

    // Check for duplicate colors within the form
    const formColors = formData.items.map(i => i.color.toLowerCase().trim());
    const hasInternalDuplicate = formColors.length !== new Set(formColors).size;
    if (hasInternalDuplicate) {
      addToast('Duplicate colors found in the form', 'er');
      return;
    }

    // Check for duplicates against database
    for (const item of formData.items) {
      const isDuplicate = orders.some(o => 
        o.poNo === formData.poNo && 
        o.color.toLowerCase() === item.color.toLowerCase().trim() && 
        (!editingOrder || o.id !== editingOrder.id)
      );

      if (isDuplicate) {
        addToast(`Color "${item.color}" already exists for PO "${formData.poNo}"`, 'er');
        return;
      }
    }

    setLoading(true);
    try {
      if (editingOrder) {
        const item = formData.items[0]; // Edits only ever have one item
        const orderData = {
          buyer: formData.buyer,
          style: formData.style,
          poNo: formData.poNo,
          shipDate: formData.shipDate,
          color: item.color,
          orderQty: item.orderQty
        };

        await updateDoc(doc(db, 'orders', String(editingOrder.id)), orderData);
        
        await addAuditLog(
          'EDIT', 
          'ORDER', 
          `Updated Order: PO ${orderData.poNo}, Color ${orderData.color}`,
          `/orders/${editingOrder.id}`
        );

        addToast('Order updated', 'ok');
      } else {
        const batch = writeBatch(db);
        formData.items.forEach(item => {
          const newDocRef = doc(collection(db, 'orders'));
          batch.set(newDocRef, {
            buyer: formData.buyer,
            style: formData.style,
            poNo: formData.poNo,
            shipDate: formData.shipDate,
            color: item.color.trim(),
            orderQty: item.orderQty
          });
        });

        await batch.commit();
        
        await addAuditLog(
          'ADD', 
          'ORDER', 
          `Added ${formData.items.length} New Orders for PO ${formData.poNo}`,
          `/orders`
        );

        addToast(`${formData.items.length} orders added successfully`, 'ok');
      }
      closeModal();
    } catch (err) {
      addToast('Failed to save order', 'er');
    } finally {
      setLoading(false);
    }
  };

  const totalQty = filteredOrders.reduce((sum, o) => sum + o.orderQty, 0);
  const uniquePOs = new Set(filteredOrders.map(o => o.poNo)).size;
  const allBuyers = Array.from(new Set([...BUYERS, ...orders.map(o => o.buyer)]));

  return (
    <div className="space-y-4">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print border-b border-white/5 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent ring-1 ring-accent/20">
            <Layers size={20} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black uppercase tracking-tighter leading-none">Order Master</h2>
              <div className="flex items-center gap-2">
                {hasPermission('manage-orders') && (
                  <button 
                    onClick={() => openModal()}
                    className="w-7 h-7 bg-accent/10 text-accent rounded-lg flex items-center justify-center hover:bg-accent hover:text-white transition-all shadow-[0_0_15px_rgba(var(--accent),0.2)] hover:shadow-[0_0_20px_rgba(var(--accent),0.4)] border border-accent/30 group"
                    title="Add New Order"
                  >
                    <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                  </button>
                )}
                <button 
                  onClick={() => setIsCollectModalOpen(true)}
                  className="w-7 h-7 bg-success/10 text-success rounded-lg flex items-center justify-center hover:bg-success hover:text-white transition-all shadow-[0_0_15px_rgba(34,197,94,0.1)] hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] border border-success/30 group"
                  title="Collect From Excel"
                >
                  <FileUp size={14} className="group-hover:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all border",
                    isFiltersOpen 
                      ? "bg-accent text-white border-accent shadow-[0_0_15px_rgba(var(--accent),0.3)]" 
                      : "bg-white/5 border-white/10 text-muted hover:text-fg hover:bg-white/10"
                  )}
                  title="Toggle Actions & Filters"
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
            <p className="text-[9px] text-muted uppercase tracking-[0.2em] font-black mt-1">System Core / Order Database</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Internal Database Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/50" />
            <input
              type="text"
              placeholder="Search matrix..."
              className="fi pl-9 h-10 w-48 lg:w-64 bg-white/5 border-white/5 text-[11px] rounded-xl focus:ring-accent/20"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats and Floating Panel */}
      <div className="relative">
        <AnimatePresence>
          {isFiltersOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-0 right-0 z-50 mt-2 mb-6 p-4 bg-card/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl ring-1 ring-white/10 w-full md:w-auto min-w-[300px]"
            >
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Quick Actions</span>
                  <button onClick={() => setIsFiltersOpen(false)} className="text-muted hover:text-fg"><X size={14} /></button>
                </div>
                
                {hasPermission('manage-orders') && (
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    <button 
                      className="btn btn-o h-9 gap-2 text-[10px] rounded-xl border-white/5 hover:bg-white/5" 
                      onClick={() => { setIsCollectModalOpen(true); setIsFiltersOpen(false); }}
                    >
                      <Database size={14} /> Collect
                    </button>
                    <button 
                      className="btn btn-o h-9 gap-2 text-[10px] rounded-xl border-white/5 hover:bg-white/5" 
                      onClick={() => { setIsHistoricalModalOpen(true); setIsFiltersOpen(false); }}
                    >
                      <HistoryIcon size={14} /> History
                    </button>
                    <button 
                      className="btn btn-o h-9 gap-2 text-[10px] rounded-xl border-white/5 hover:bg-white/5 col-span-2" 
                      onClick={() => { setIsBulkModalOpen(true); setIsFiltersOpen(false); }}
                    >
                      <FileUp size={14} /> Bulk Master Import
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold text-muted uppercase ml-1">Database Health</span>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent w-[85%] rounded-full shadow-[0_0_10px_rgba(var(--accent),0.5)]" />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="bg-bg2/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-6 flex-wrap shadow-xl ring-1 ring-white/5 no-print mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-accent/10 flex items-center justify-center text-accent ring-1 ring-accent/20 font-black text-xs uppercase">
              DB
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-tight">Active Orders</div>
              <div className="text-lg font-black leading-none">{filteredOrders.length}</div>
            </div>
          </div>

          <div className="w-px h-8 bg-white/5" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 ring-1 ring-emerald-500/20 font-black text-xs uppercase">
              VOL
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-tight">Total Volume</div>
              <div className="text-lg font-black leading-none">{(totalQty || 0).toLocaleString()}</div>
            </div>
          </div>
          
          <div className="w-px h-8 bg-white/5" />

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 ring-1 ring-amber-500/20 font-black text-xs uppercase">
              PO
            </div>
            <div>
              <div className="text-[10px] text-muted font-bold uppercase tracking-tight">Unique POs</div>
              <div className="text-lg font-black leading-none">{uniquePOs}</div>
            </div>
          </div>

          {selectedIds.size > 0 && hasPermission('manage-orders') && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 border-l border-white/5 pl-6 ml-auto"
            >
              <span className="text-[10px] text-accent font-black uppercase bg-accent/10 px-2 py-1 rounded-md">{selectedIds.size} Selected</span>
              <div className="flex gap-1">
                <button className="p-2 bg-accent/10 text-accent hover:bg-accent hover:text-white rounded-lg transition-all" onClick={() => setIsBulkUpdateModalOpen(true)} title="Bulk Edit">
                  <Pencil size={14} />
                </button>
                <button className="p-2 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-lg transition-all" onClick={() => setIsBulkDeleteConfirmOpen(true)} title="Bulk Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-bg2/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/5">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)] custom-scrollbar">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 z-20 bg-bg2/95 backdrop-blur-md">
              <tr className="border-b border-white/5">
                <th className="py-3 px-4 w-12">
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent focus:ring-accent/30 transition-all cursor-pointer"
                      checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                      onChange={toggleSelectAll}
                    />
                  </div>
                </th>
                <th className="py-3 px-2 text-[10px] font-black text-muted/50 uppercase tracking-widest text-center w-10">#</th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('buyer')}>
                  <div className="flex items-center gap-2">
                    Buyer {getSortIcon('buyer')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('style')}>
                  <div className="flex items-center gap-2">
                    Style {getSortIcon('style')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group text-center" onClick={() => handleSort('poNo')}>
                  <div className="flex items-center justify-center gap-2">
                    PO No {getSortIcon('poNo')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group text-center" onClick={() => handleSort('shipDate')}>
                  <div className="flex items-center justify-center gap-2">
                    Ship Date {getSortIcon('shipDate')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group text-center" onClick={() => handleSort('color')}>
                  <div className="flex items-center justify-center gap-2">
                    Color {getSortIcon('color')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest cursor-pointer hover:bg-white/5 transition-colors group text-center" onClick={() => handleSort('orderQty')}>
                  <div className="flex items-center justify-center gap-2">
                    Qty {getSortIcon('orderQty')}
                  </div>
                </th>
                <th className="py-3 px-4 text-[10px] font-black text-muted uppercase tracking-widest text-center no-print">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.02]">
              {filteredOrders.map((order, i) => (
                <motion.tr 
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  key={order.id} 
                  className={cn(
                    "transition-all duration-200 group h-10", 
                    selectedIds.has(order.id) ? "bg-accent/10" : "hover:bg-white/[0.02]"
                  )}
                >
                  <td className="px-4">
                    <div className="flex justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-white/10 bg-white/5 text-accent focus:ring-accent/30 transition-all cursor-pointer"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                      />
                    </div>
                  </td>
                  <td className="px-2 text-center text-[10px] font-mono text-muted/30">{i + 1}</td>
                  <td className="px-4">
                    <div className="text-xs font-black text-fg mb-0.5">{order.buyer}</div>
                  </td>
                  <td className="px-4">
                    <div className="text-[10px] font-mono opacity-50 truncate max-w-[120px]">{order.style}</div>
                  </td>
                  <td className="px-4 text-center">
                    <div className="inline-block px-2 py-0.5 bg-accent/5 rounded-md text-[10px] font-black text-accent border border-accent/10 font-mono">
                      {order.poNo}
                    </div>
                  </td>
                  <td className="px-4 text-center">
                    <div className="text-[10px] font-bold opacity-70 italic font-mono">{safeFormat(order.shipDate)}</div>
                  </td>
                  <td className="px-4 text-center">
                    <div className="text-[10px] font-medium opacity-80">{order.color}</div>
                  </td>
                  <td className="px-4 text-center">
                    <div className="text-xs font-black text-fg font-mono">{(order.orderQty || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-4 no-print">
                    <div className="flex justify-center translate-x-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                      {hasPermission('manage-orders') ? (
                        <div className="flex items-center bg-bg shadow-2xl border border-white/5 rounded-lg p-1 scale-90">
                          <button className="p-1.5 hover:bg-accent/10 hover:text-accent rounded-md transition-colors" onClick={() => openModal(order)} title="Edit">
                            <Pencil size={12} />
                          </button>
                          <div className="w-px h-3 bg-white/5 mx-1" />
                          <button className="p-1.5 hover:bg-danger/10 hover:text-danger rounded-md transition-colors" onClick={() => handleDeleteClick(order.id)} title="Delete">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[9px] text-muted italic">View Only</span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-32 text-center">
                    <div className="flex flex-col items-center justify-center gap-4 opacity-20">
                      <div className="p-8 rounded-full bg-white/5 ring-1 ring-white/10">
                        <Database size={64} className="animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black uppercase tracking-widest">Database Empty</h3>
                        <p className="text-[10px] font-mono tracking-wider">Awaiting mission parameters...</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* Modal */}
      <AnimatePresence>
        {isCollectModalOpen && (
          <CollectFromExcelModal 
            type="orders"
            orders={orders}
            onClose={() => setIsCollectModalOpen(false)}
            onSuccess={(count) => {
              addToast(`Knowledge Base Refined: ${count} orders integrated`, 'ok');
              setIsCollectModalOpen(false);
            }}
          />
        )}
        
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-border bg-bg2">
                <h3 className="text-base font-bold flex items-center gap-2">
                  {editingOrder ? <Pencil size={16} className="text-accent" /> : <Plus size={16} className="text-accent" />}
                  {editingOrder ? 'Edit Order' : 'Add New Order'}
                </h3>
                <button onClick={closeModal} className="text-muted hover:text-fg transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={saveOrder} className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Buyer *</label>
                    <input 
                      name="buyer" 
                      value={formData.buyer}
                      onChange={handleFormChange}
                      className="fi" 
                      placeholder="Type or Select Buyer"
                      autoComplete="off"
                      list="buyer-list"
                      required 
                    />
                    <datalist id="buyer-list">
                      {allBuyers.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Style No *</label>
                    <input 
                      name="style" 
                      type="text" 
                      value={formData.style} 
                      onChange={handleFormChange} 
                      className="fi" 
                      placeholder="Type or Select Style" 
                      autoComplete="off"
                      list="style-list"
                      required 
                    />
                    <datalist id="style-list">
                      {Array.from(new Set(orders.map(o => o.style))).sort().map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">PO No *</label>
                    <input name="poNo" type="text" value={formData.poNo} onChange={handleFormChange} className="fi" placeholder="e.g. PO-1001" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Ship Date *</label>
                    <input name="shipDate" type="date" value={formData.shipDate} onChange={handleFormChange} className="fi" required />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Colors & Quantities *</label>
                    {!editingOrder && (
                      <button 
                        type="button" 
                        onClick={addRow}
                        className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent hover:bg-accent hover:text-white transition-all shadow-sm"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  
                  <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
                    {formData.items.map((item, idx) => (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end border-b border-border/10 pb-3 sm:border-0 sm:pb-0"
                      >
                        <div className="flex-1 space-y-1">
                          <span className="text-[9px] text-muted font-bold uppercase ml-1 block sm:hidden">Color</span>
                          {idx === 0 && <span className="text-[9px] text-muted font-bold uppercase ml-1 hidden sm:block">Color</span>}
                          <input 
                            value={item.color} 
                            onChange={(e) => handleItemChange(idx, 'color', e.target.value)} 
                            className="fi h-10" 
                            placeholder="Color name" 
                            required 
                          />
                        </div>
                        <div className="w-full sm:w-32 space-y-1">
                          <span className="text-[9px] text-muted font-bold uppercase ml-1 block sm:hidden">Order Qty</span>
                          {idx === 0 && <span className="text-[9px] text-muted font-bold uppercase ml-1 hidden sm:block">Order Qty</span>}
                          <input 
                            type="number" 
                            value={item.orderQty || ''} 
                            onChange={(e) => handleItemChange(idx, 'orderQty', e.target.value)} 
                            className="fi h-10" 
                            placeholder="Qty" 
                            min="1" 
                            required 
                          />
                        </div>
                        {!editingOrder && formData.items.length > 1 && (
                          <button 
                            type="button" 
                            onClick={() => removeRow(idx)}
                            className="h-10 sm:h-10 sm:w-10 rounded-xl bg-danger/5 text-danger/40 hover:text-danger hover:bg-danger/10 flex items-center justify-center transition-colors px-4 sm:px-0"
                          >
                            <X size={14} className="mr-2 sm:mr-0" />
                            <span className="sm:hidden text-[10px] font-bold">Remove Item</span>
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="btn btn-o">Cancel</button>
                  <button type="submit" className="btn btn-p" disabled={loading}>
                    <Save size={14} /> {loading ? 'Saving...' : (editingOrder ? 'Update Order' : 'Save Orders')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Update Modal */}
      <AnimatePresence>
        {isBulkUpdateModalOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkUpdateModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                  <Pencil size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Bulk Update</h3>
                  <p className="text-[10px] text-muted uppercase">Updating {selectedIds.size} selected orders</p>
                </div>
              </div>

              <form onSubmit={handleBulkUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider">New Buyer</label>
                  <input 
                    className="fi"
                    placeholder="Leave empty to keep current"
                    value={bulkUpdateData.buyer}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, buyer: e.target.value }))}
                    list="bulk-buyer-list-update"
                  />
                  <datalist id="bulk-buyer-list-update">
                    {allBuyers.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-wider">New Style</label>
                  <input 
                    className="fi"
                    placeholder="Leave empty to keep current"
                    value={bulkUpdateData.style}
                    onChange={(e) => setBulkUpdateData(prev => ({ ...prev, style: e.target.value }))}
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setIsBulkUpdateModalOpen(false)} className="btn btn-o flex-1">Cancel</button>
                  <button type="submit" className="btn btn-p flex-1" disabled={loading}>
                    {loading ? 'Updating...' : 'Update All'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              <p className="text-sm text-muted mb-6">Are you sure you want to delete this order? This action cannot be undone.</p>
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
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkDeleteConfirmOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 400 }}
              className="relative bg-card border border-border rounded-xl shadow-2xl p-6 max-w-sm w-full text-center"
            >
              <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} className="text-danger" />
              </div>
              <h3 className="text-lg font-bold mb-2">Bulk Delete</h3>
              <p className="text-sm text-muted mb-6">
                Are you sure you want to delete <span className="text-danger font-bold">{selectedIds.size}</span> selected orders? This action is permanent.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setIsBulkDeleteConfirmOpen(false)} className="btn btn-o flex-1">Cancel</button>
                <button 
                  onClick={handleBulkDelete} 
                  className="btn btn-d flex-1"
                  disabled={loading}
                >
                  {loading ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Bulk Import Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <BulkImportModal 
            onClose={() => setIsBulkModalOpen(false)}
            onSave={async (newOrders) => {
              setLoading(true);
              try {
                const batch = writeBatch(db);
                newOrders.forEach(order => {
                  const newDocRef = doc(collection(db, 'orders'));
                  batch.set(newDocRef, order);
                });
                await batch.commit();
                
                await addAuditLog(
                  'ADD', 
                  'ORDER', 
                  `Bulk Imported ${newOrders.length} Orders`,
                  '/orders'
                );
                
                addToast(`${newOrders.length} orders imported successfully`, 'ok');
                setIsBulkModalOpen(false);
              } catch (err) {
                console.error(err);
                addToast('Failed to import orders', 'er');
              } finally {
                setLoading(false);
              }
            }}
            existingOrders={orders}
          />
        )}
      </AnimatePresence>

      {/* Historical Import Modal */}
      <AnimatePresence>
        {isHistoricalModalOpen && (
          <HistoricalImportModal 
            onClose={() => setIsHistoricalModalOpen(false)}
            orders={orders}
            onSave={async (entries) => {
              setLoading(true);
              try {
                const batch = writeBatch(db);
                entries.forEach(entry => {
                  const newDocRef = doc(collection(db, 'entries'));
                  batch.set(newDocRef, entry);
                });
                await batch.commit();
                
                await addAuditLog(
                  'ADD', 
                  'PRODUCTION', 
                  `Imported Historical Data for ${entries.length} items`,
                  '/production'
                );
                
                addToast(`${entries.length} historical entries imported successfully`, 'ok');
                setIsHistoricalModalOpen(false);
              } catch (err) {
                console.error(err);
                addToast('Failed to import historical data', 'er');
              } finally {
                setLoading(false);
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

interface BulkImportModalProps {
  onClose: () => void;
  onSave: (orders: Omit<Order, 'id'>[]) => Promise<void>;
  existingOrders: Order[];
}

function BulkImportModal({ onClose, onSave, existingOrders }: BulkImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [buyer, setBuyer] = useState('');
  const [parsedData, setParsedData] = useState<(Omit<Order, 'id'> & { error?: string; isDuplicate?: boolean })[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [headerMap, setHeaderMap] = useState<Record<string, number>>({});

  const allBuyers = useMemo(() => {
    const fromOrders = existingOrders.map(o => o.buyer);
    return Array.from(new Set([...BUYERS, ...fromOrders])).sort();
  }, [existingOrders]);

  const commonHeaderMaps: Record<string, string[]> = {
    style: ['style', 'style no', 'style#', 'item', 'model'],
    poNo: ['po no', 'po number', 'po#', 'order id', 'order no', 'purchase order'],
    shipDate: ['ship date', 'shipment date', 'delivery date', 'date', 'shipment', 'ex-factory'],
    color: ['color', 'colour', 'shade'],
    orderQty: ['order qty', 'qty', 'order quantity', 'quantity', 'total qty', 'order_qty'],
  };

  const findHeaderIndex = (headers: string[], targetKeys: string[]) => {
    return headers.findIndex(h => {
      const normalizedHeader = h.toLowerCase().trim();
      return targetKeys.some(key => normalizedHeader.includes(key.toLowerCase()));
    });
  };

  const handleParse = () => {
    const lines = rawText.split('\n').filter(l => l.trim());
    if (lines.length === 0) return;

    const results: (Omit<Order, 'id'> & { error?: string; isDuplicate?: boolean })[] = [];
    const errs: string[] = [];
    
    if (!buyer) {
      errs.push('Please select or type a Buyer');
      setErrors(errs);
      return;
    }

    // Attempt to detect headers from the first line
    let dataStartIdx = 0;
    let detectedMap: Record<string, number> = {};

    const firstLineParts = lines[0].split(/\t+/).map(p => p.trim()).filter(p => p !== '');
    const isHeaderCandidate = firstLineParts.some(p => 
      ['style', 'po', 'color', 'qty', 'date'].some(key => p.toLowerCase().includes(key))
    );

    if (isHeaderCandidate) {
      Object.entries(commonHeaderMaps).forEach(([key, aliases]) => {
        const idx = findHeaderIndex(firstLineParts, aliases);
        if (idx !== -1) detectedMap[key] = idx;
      });
      dataStartIdx = 1;
      setHeaderMap(detectedMap);
    } else {
      // Use standard mapping if no header detected
      // Expected: STYLE, PO NO, SHIP DATE, COLOR, ORDER QTY
      detectedMap = { style: 0, poNo: 1, shipDate: 2, color: 3, orderQty: 4 };
      setHeaderMap({});
    }

    const dataLines = lines.slice(dataStartIdx);

    dataLines.forEach((line, idx) => {
      // Excel copy paste is tab separated
      const parts = line.split('\t').map(p => p.trim());
      
      const getVal = (key: string) => {
        const index = detectedMap[key];
        return index !== undefined ? parts[index] : '';
      };

      const style = getVal('style');
      const poNo = getVal('poNo');
      const shipDateStr = getVal('shipDate');
      const color = getVal('color');
      const qtyStr = getVal('orderQty');
      
      if (!style && !poNo) return;
      
      // Skip summary or header rows
      if (style?.toLowerCase().includes('style') || !style || !poNo || !qtyStr || isNaN(Number(qtyStr.replace(/,/g, '')))) return;

      let rowError = '';

      try {
        let shipDate = '';
        const currentYear = new Date().getFullYear();
        
        const isoDate = parseISO(shipDateStr);
        if (isValid(isoDate)) {
          shipDate = format(isoDate, 'yyyy-MM-dd');
        } else {
          const formats = ['dd-MMM-yy', 'dd-MMM', 'dd MMM', 'dd-MM-yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'MMM-dd', 'MMM dd'];
          let parsedDate: Date | null = null;
          
          for (const f of formats) {
            try {
              const d = parse(shipDateStr, f, new Date());
              if (isValid(d)) {
                if (d.getFullYear() < 2000) d.setFullYear(currentYear);
                parsedDate = d;
                break;
              }
            } catch { continue; }
          }
          
          if (parsedDate) {
            shipDate = format(parsedDate, 'yyyy-MM-dd');
          } else {
            shipDate = shipDateStr; 
          }
        }

        const qty = Number(qtyStr.replace(/,/g, ''));
        
        const orderData = {
          buyer: buyer,
          style,
          poNo,
          shipDate,
          color,
          orderQty: qty
        };

        // Strict Duplicate Check: PO No + Color
        const isDuplicateInImport = results.some(r => 
          !r.error &&
          r.poNo.toLowerCase().trim() === poNo.toLowerCase().trim() && 
          r.color.toLowerCase().trim() === color.toLowerCase().trim()
        );

        const isDuplicateInDB = existingOrders.some(o => 
          o.poNo.toLowerCase().trim() === poNo.toLowerCase().trim() && 
          o.color.toLowerCase().trim() === color.toLowerCase().trim()
        );

        const isDuplicate = isDuplicateInImport || isDuplicateInDB;
        
        if (isDuplicate) {
          rowError = `DUPLICATE`;
          errs.push(`Row ${idx + 1}: Duplicate entry (PO: ${poNo}, Color: ${color})`);
        }
        
        results.push({ ...orderData, error: rowError, isDuplicate: !!isDuplicate });
      } catch (e) {
        const msg = 'Invalid data format';
        errs.push(`Row ${idx + 1}: ${msg}`);
        results.push({
          buyer: buyer,
          style: style || '?',
          poNo: poNo || '?',
          shipDate: shipDateStr || '?',
          color: color || '?',
          orderQty: 0,
          error: msg
        });
      }
    });

    setParsedData(results);
    setErrors(errs);
  };

  const handleConfirmSave = async () => {
    const dataToSave = parsedData.filter(r => !r.error || r.isDuplicate);
    if (dataToSave.length === 0) return;

    const duplicates = dataToSave.filter(r => r.isDuplicate);
    if (duplicates.length > 0) {
      const proceed = window.confirm(`${duplicates.length} duplicate orders were detected. Do you want to add them anyway?\n\n- Click 'OK' to add ALL (including duplicates).\n- Click 'Cancel' to ONLY add new unique orders.`);
      
      let finalData = dataToSave;
      if (!proceed) {
        finalData = dataToSave.filter(r => !r.isDuplicate);
      }
      
      if (finalData.length === 0) return;
      
      setLoading(true);
      await onSave(finalData);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    await onSave(dataToSave);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-bg2">
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileUp size={18} className="text-accent" />
            Bulk Import Orders from Excel/Sheets
          </h3>
          <button onClick={onClose} className="text-muted hover:text-fg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider">1. Select or Type Buyer *</label>
                <input 
                  value={buyer} 
                  onChange={(e) => setBuyer(e.target.value)}
                  className="fi"
                  placeholder="Type or Select Buyer"
                  list="bulk-buyer-list"
                  autoComplete="off"
                />
                <datalist id="bulk-buyer-list">
                  {allBuyers.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted uppercase tracking-wider">2. Paste Data from Excel *</label>
                <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg space-y-2">
                  <p className="text-[10px] text-muted leading-relaxed">
                    <span className="text-accent font-bold">✨ Smart Mapping:</span> Paste your data <span className="underline">including the header row</span>. The app will automatically find Style, PO, Color, and Qty regardless of column order.
                  </p>
                  {Object.keys(headerMap).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.keys(headerMap).map(key => (
                        <span key={key} className="px-1.5 py-0.5 bg-accent/10 text-accent rounded text-[9px] font-bold uppercase ring-1 ring-accent/20">
                          {key} ✓
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <textarea 
                  className="fi min-h-[300px] font-mono text-[11px] leading-relaxed"
                  placeholder="Paste rows (with headers) here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
                <button 
                  onClick={handleParse}
                  className="btn btn-p w-full mt-2"
                  disabled={!rawText || !buyer}
                >
                  Preview & Validate
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-bold text-muted uppercase tracking-wider">3. Preview & Errors</label>
              
              {errors.length > 0 && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg space-y-1">
                  <div className="flex items-center gap-2 text-danger text-[11px] font-bold">
                    <AlertCircle size={14} /> Validation Errors:
                  </div>
                  <ul className="text-[10px] text-danger/80 list-disc pl-4 max-h-[100px] overflow-y-auto">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              <div className="border border-border rounded-lg overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="et text-[10px]">
                    <thead className="sticky top-0 bg-bg2">
                      <tr>
                        <th>Style</th>
                        <th>PO</th>
                        <th>Ship Date</th>
                        <th>Color</th>
                        <th>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((row, i) => (
                        <tr key={i} className={cn(
                          row.error && row.error !== 'DUPLICATE' ? "bg-danger/10" : "",
                          row.isDuplicate ? "bg-amber-500/5" : ""
                        )}>
                          <td className={cn(row.error && !row.isDuplicate && "text-danger font-bold")}>{row.style}</td>
                          <td className={cn("font-bold", row.error && !row.isDuplicate ? "text-danger" : "text-accent")}>{row.poNo}</td>
                          <td className={cn(row.error && !row.isDuplicate && "text-danger")}>{row.shipDate}</td>
                          <td className={cn(row.error && !row.isDuplicate && "text-danger")}>{row.color}</td>
                          <td className={cn("num", row.error && !row.isDuplicate && "text-danger")}>
                            <div className="flex items-center gap-2">
                              {row.orderQty.toLocaleString()}
                              {row.isDuplicate && (
                                <span className="bg-amber-500/20 text-amber-500 px-1 rounded-[4px] text-[8px] font-black uppercase tracking-tighter">Existing</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {parsedData.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-10 text-center text-muted italic">
                            No data parsed yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-bg2 flex justify-between items-center">
          <div className="text-xs text-muted">
            Total Valid: <span className="text-accent font-bold">{parsedData.filter(r => !r.error || r.isDuplicate).length}</span> 
            {parsedData.some(r => r.isDuplicate) && (
              <span className="ml-2 text-amber-500 font-bold">
                ({parsedData.filter(r => r.isDuplicate).length} duplicates)
              </span>
            )}
            {parsedData.some(r => r.error && !r.isDuplicate) && (
              <span className="ml-2 text-danger font-bold">
                ({parsedData.filter(r => r.error && !r.isDuplicate).length} errors)
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-o">Cancel</button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-p px-8"
              disabled={parsedData.filter(r => !r.error || r.isDuplicate).length === 0 || loading}
            >
              {loading ? 'Importing...' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
