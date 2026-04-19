import React, { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Database, X, Save, Search, FileUp, AlertCircle, CheckCircle2, History as HistoryIcon, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn, safeFormat } from '../lib/utils';
import { Order, ProductionEntry } from '../types';
import { BUYERS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, parse, isValid } from 'date-fns';
import { db, addAuditLog } from '../firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import HistoricalImportModal from './HistoricalImportModal';

interface OrderMasterProps {
  orders: Order[];
  addToast: (msg: string, type?: 'ok' | 'er' | 'in') => void;
  userProfile: { role: string; permissions?: string[] } | null;
}

export default function OrderMaster({ orders, addToast, userProfile }: OrderMasterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const [isHistoricalModalOpen, setIsHistoricalModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
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
      // Default fallback sort
      result.sort((a, b) => {
        const buyerCmp = a.buyer.localeCompare(b.buyer);
        if (buyerCmp !== 0) return buyerCmp;
        const styleCmp = a.style.localeCompare(b.style);
        if (styleCmp !== 0) return styleCmp;
        return a.poNo.localeCompare(b.poNo);
      });
    }

    return result;
  }, [orders, search, sortConfig]);

  const handleSort = (key: keyof Order) => {
    setSortConfig(prev => {
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
    color: '',
    orderQty: 0
  });

  const openModal = (order: Order | null = null) => {
    if (order) {
      setEditingOrder(order);
      setFormData({
        buyer: order.buyer || '',
        style: order.style || '',
        poNo: order.poNo || '',
        shipDate: order.shipDate || '',
        color: order.color || '',
        orderQty: order.orderQty || 0
      });
    } else {
      setEditingOrder(null);
      setFormData({
        buyer: '',
        style: '',
        poNo: '',
        shipDate: format(new Date(), 'yyyy-MM-dd'),
        color: '',
        orderQty: 0
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
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value
    }));
  };

  const saveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.buyer || !formData.style || !formData.poNo || !formData.shipDate || !formData.color || !formData.orderQty) {
      addToast('Please fill all required fields', 'er');
      return;
    }

    const orderData: Omit<Order, 'id'> = { ...formData };

    // Duplicate check: PO + Color must be unique
    const isDuplicate = orders.some(o => 
      o.poNo === orderData.poNo && 
      o.color.toLowerCase() === orderData.color.toLowerCase() && 
      (!editingOrder || o.id !== editingOrder.id)
    );

    if (isDuplicate) {
      addToast(`Color "${orderData.color}" already exists for PO "${orderData.poNo}"`, 'er');
      return;
    }

    setLoading(true);
    try {
      if (editingOrder) {
        await updateDoc(doc(db, 'orders', String(editingOrder.id)), orderData);
        
        await addAuditLog(
          'EDIT', 
          'ORDER', 
          `Updated Order: PO ${orderData.poNo}, Color ${orderData.color}`,
          `/orders/${editingOrder.id}`
        );

        addToast('Order updated', 'ok');
      } else {
        const docRef = await addDoc(collection(db, 'orders'), orderData);
        
        await addAuditLog(
          'ADD', 
          'ORDER', 
          `Added New Order: PO ${orderData.poNo}, Color ${orderData.color}`,
          `/orders/${docRef.id}`
        );

        addToast('Order added', 'ok');
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
      <div className="flex items-center justify-between flex-wrap gap-2 no-print">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Database size={20} className="text-accent" />
            Order Master
          </h2>
          <p className="text-[11px] text-muted">Manage buyers, styles, POs, and order quantities</p>
        </div>
        <div className="flex items-center gap-2 flex-1 md:flex-none min-w-[250px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Search PO, Buyer or Style..."
              className="fi pl-10 h-10 rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {hasPermission('manage-orders') && (
            <div className="flex gap-2">
              <button 
                className="btn btn-o h-10 px-4 gap-2 text-accent border-accent/20 hover:bg-accent/5 rounded-xl" 
                onClick={() => setIsHistoricalModalOpen(true)}
                title="Import previous production data"
              >
                <HistoryIcon size={16} /> Historical Import
              </button>
              <button className="btn btn-o h-10 px-4 gap-2 rounded-xl" onClick={() => setIsBulkModalOpen(true)}>
                <FileUp size={16} /> Bulk Import
              </button>
              <button className="btn btn-p h-10 px-4 gap-2 rounded-xl" onClick={() => openModal()}>
                <Plus size={16} /> Add Order
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-bg2/50 backdrop-blur-sm border border-border rounded-2xl px-5 py-3 flex items-center gap-6 flex-wrap shadow-xl ring-1 ring-white/5 no-print">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-mono font-black text-xs shadow-inner">fx</div>
          <span className="text-[11px] text-muted font-mono uppercase tracking-widest">
            COUNT: <span className="text-accent font-black">{filteredOrders.length}</span>
          </span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="text-[11px] text-muted font-mono uppercase tracking-widest">
          SUM(Qty): <span className="text-accent font-black">{(totalQty || 0).toLocaleString()}</span>
        </div>
        <div className="w-px h-6 bg-border" />
        <div className="text-[11px] text-muted font-mono uppercase tracking-widest">
          UNIQUE(PO): <span className="text-accent font-black">{uniquePOs}</span>
        </div>

        {selectedIds.size > 0 && hasPermission('manage-orders') && (
          <>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-4 animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-[11px] text-accent font-black uppercase tracking-widest">
                {selectedIds.size} Selected
              </span>
              <div className="flex gap-2">
                <button 
                  className="btn btn-a h-8 px-4 text-[10px] gap-2 rounded-lg shadow-lg shadow-info/20"
                  onClick={() => setIsBulkUpdateModalOpen(true)}
                >
                  <Pencil size={14} /> Bulk Edit
                </button>
                <button 
                  className="btn btn-d h-8 px-4 text-[10px] gap-2 rounded-lg shadow-lg shadow-danger/20"
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                >
                  <Trash2 size={14} /> Delete Selected
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="bg-bg2/50 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5">
        <div className="overflow-x-auto max-h-[60vh] no-scrollbar">
          <table className="et">
            <thead>
              <tr>
                <th className="w-12">
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded-lg border-border bg-bg text-accent focus:ring-accent/30 transition-all cursor-pointer"
                      checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                      onChange={toggleSelectAll}
                    />
                  </div>
                </th>
                <th className="w-10">#</th>
                <th className="text-left cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('buyer')}>
                  <div className="flex items-center gap-2">
                    Buyer {getSortIcon('buyer')}
                  </div>
                </th>
                <th className="text-left cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('style')}>
                  <div className="flex items-center gap-2">
                    Style {getSortIcon('style')}
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('poNo')}>
                  <div className="flex items-center justify-center gap-2">
                    PO No {getSortIcon('poNo')}
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('shipDate')}>
                  <div className="flex items-center justify-center gap-2">
                    Ship Date {getSortIcon('shipDate')}
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('color')}>
                  <div className="flex items-center justify-center gap-2">
                    Color {getSortIcon('color')}
                  </div>
                </th>
                <th className="cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('orderQty')}>
                  <div className="flex items-center justify-center gap-2">
                    Order Qty {getSortIcon('orderQty')}
                  </div>
                </th>
                <th className="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order, i) => (
                <tr key={order.id} className={cn("transition-colors", selectedIds.has(order.id) ? "bg-accent/10" : "hover:bg-white/5")}>
                  <td>
                    <div className="flex justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded-lg border-border bg-bg text-accent focus:ring-accent/30 transition-all cursor-pointer"
                        checked={selectedIds.has(order.id)}
                        onChange={() => toggleSelect(order.id)}
                      />
                    </div>
                  </td>
                  <td className="num text-muted/50">{i + 1}</td>
                  <td className="text-left font-black text-fg">{order.buyer}</td>
                  <td className="text-left font-mono text-[11px] opacity-70">{order.style}</td>
                  <td className="font-mono font-black text-accent text-[11px]">{order.poNo}</td>
                  <td className="text-[11px] font-bold">{safeFormat(order.shipDate)}</td>
                  <td className="text-[11px]">{order.color}</td>
                  <td className="num font-black text-fg">{(order.orderQty || 0).toLocaleString()}</td>
                  <td className="no-print">
                    <div className="flex gap-2 justify-center">
                      {hasPermission('manage-orders') ? (
                        <>
                          <button className="btn btn-o btn-s rounded-lg hover:bg-accent/10 hover:text-accent border-border/50" onClick={() => openModal(order)}>
                            <Pencil size={12} />
                          </button>
                          <button className="btn btn-d btn-s rounded-lg hover:bg-danger/10 hover:text-danger border-border/50" onClick={() => handleDeleteClick(order.id)}>
                            <Trash2 size={12} />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted italic">View Only</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-24 text-center text-muted">
                    <Database size={48} className="mx-auto mb-4 opacity-10" />
                    <h3 className="text-lg font-bold opacity-40">No orders found</h3>
                    <p className="text-sm opacity-30">Click "Add Order" to start building your database</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
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

              <form onSubmit={saveOrder} className="p-6 space-y-4">
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
                    <input name="style" type="text" value={formData.style} onChange={handleFormChange} className="fi" placeholder="e.g. NRF26-2015W" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">PO No *</label>
                    <input name="poNo" type="text" value={formData.poNo} onChange={handleFormChange} className="fi" placeholder="e.g. PO-1001" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Ship Date *</label>
                    <input name="shipDate" type="date" value={formData.shipDate} onChange={handleFormChange} className="fi" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Color *</label>
                    <input name="color" type="text" value={formData.color} onChange={handleFormChange} className="fi" placeholder="e.g. Flintstone" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted uppercase tracking-wider">Order Qty *</label>
                    <input name="orderQty" type="number" value={formData.orderQty || ''} onChange={handleFormChange} className="fi" min="1" required />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={closeModal} className="btn btn-o">Cancel</button>
                  <button type="submit" className="btn btn-p">
                    <Save size={14} /> {editingOrder ? 'Update Order' : 'Save Order'}
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
}

interface BulkImportModalProps {
  onClose: () => void;
  onSave: (orders: Omit<Order, 'id'>[]) => Promise<void>;
  existingOrders: Order[];
}

function BulkImportModal({ onClose, onSave, existingOrders }: BulkImportModalProps) {
  const [rawText, setRawText] = useState('');
  const [buyer, setBuyer] = useState('');
  const [parsedData, setParsedData] = useState<(Omit<Order, 'id'> & { error?: string })[]>([]);
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

    const results: (Omit<Order, 'id'> & { error?: string })[] = [];
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

        // Refined Duplicate Check: Buyer + Style + PO No + Color
        const isDuplicateInImport = results.some(r => 
          !r.error &&
          r.buyer === orderData.buyer &&
          r.style.toLowerCase() === orderData.style.toLowerCase() &&
          r.poNo === orderData.poNo && 
          r.color.toLowerCase() === orderData.color.toLowerCase()
        );

        const isDuplicateInDB = existingOrders.some(o => 
          o.buyer === orderData.buyer &&
          o.style.toLowerCase() === orderData.style.toLowerCase() &&
          o.poNo === orderData.poNo && 
          o.color.toLowerCase() === orderData.color.toLowerCase()
        );

        if (isDuplicateInImport || isDuplicateInDB) {
          rowError = `Duplicate Entry (Style: ${style}, PO: ${poNo}, Color: ${color})`;
          errs.push(`Row ${idx + 1}: ${rowError}`);
        }
        
        results.push({ ...orderData, error: rowError });
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
    const validData = parsedData.filter(r => !r.error);
    if (validData.length === 0) return;
    
    setLoading(true);
    await onSave(validData);
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
                        <tr key={i} className={cn(row.error && "bg-danger/10")}>
                          <td className={cn(row.error && "text-danger font-bold")}>{row.style}</td>
                          <td className={cn("font-bold", row.error ? "text-danger" : "text-accent")}>{row.poNo}</td>
                          <td className={cn(row.error && "text-danger")}>{row.shipDate}</td>
                          <td className={cn(row.error && "text-danger")}>{row.color}</td>
                          <td className={cn("num", row.error && "text-danger")}>{row.orderQty.toLocaleString()}</td>
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
            Ready to import: <span className="text-accent font-bold">{parsedData.filter(r => !r.error).length}</span> orders
            {parsedData.some(r => r.error) && (
              <span className="ml-2 text-danger font-bold">
                ({parsedData.filter(r => r.error).length} errors found)
              </span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-o">Cancel</button>
            <button 
              onClick={handleConfirmSave} 
              className="btn btn-p px-8"
              disabled={parsedData.filter(r => !r.error).length === 0 || loading}
            >
              {loading ? 'Importing...' : 'Confirm & Save Valid'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
