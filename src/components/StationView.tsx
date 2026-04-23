import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Minus, 
  Save, 
  ArrowRightLeft, 
  Hash, 
  Activity, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  Layers,
  ChevronRight,
  User
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface StationViewProps {
  styleName: string;
  colors: { color: string; orderQty: number; input: number; output: number }[];
  currentAggregates: Record<string, any>;
  onSubmit: (data: { date: string; color: string; lineNo: string; input: number; output: number }) => Promise<void>;
}

export default function StationView({ styleName, colors, currentAggregates, onSubmit }: StationViewProps) {
  const [selectedColor, setSelectedColor] = useState(colors[0]?.color || '');
  const [lineNo, setLineNo] = useState('1');
  const [inputQty, setInputQty] = useState(0);
  const [outputQty, setOutputQty] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeColorData = currentAggregates[selectedColor];

  const handleSave = async () => {
    if (!selectedColor) return setError('Please select a color');
    if (inputQty === 0 && outputQty === 0) return setError('Enter quantity larger than 0');

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit({
        date: format(new Date(), 'yyyy-MM-dd'),
        color: selectedColor,
        lineNo: lineNo,
        input: inputQty,
        output: outputQty
      });
      setSuccess(true);
      setInputQty(0);
      setOutputQty(0);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError('Failed to save record. Check connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const adjustQty = (type: 'input' | 'output', amount: number) => {
    if (type === 'input') {
      setInputQty(prev => Math.max(0, prev + amount));
    } else {
      setOutputQty(prev => Math.max(0, prev + amount));
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24">
      {/* Station Header */}
      <div className="bg-bg2/80 backdrop-blur-3xl border border-border rounded-[40px] p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <Activity size={80} />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
           <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-accent/10 rounded-[22px] flex items-center justify-center border border-accent/20">
                 <Activity size={28} className="text-accent" />
              </div>
              <div>
                 <h2 className="text-2xl font-black tracking-tight uppercase leading-none text-white">Station Operator</h2>
                 <p className="text-[10px] text-muted font-black tracking-[0.2em] uppercase mt-2">Active Style: <span className="text-accent">{styleName}</span></p>
              </div>
           </div>
           <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-bg rounded-xl border border-border flex flex-col items-center">
                 <span className="text-[8px] font-black text-muted uppercase">Line No</span>
                 <span className="text-sm font-black text-white">STN-{lineNo}</span>
              </div>
              <div className="px-4 py-2 bg-bg rounded-xl border border-border flex flex-col items-center">
                 <span className="text-[8px] font-black text-muted uppercase">Shift</span>
                 <span className="text-sm font-black text-white">DAY (A)</span>
              </div>
           </div>
        </div>
      </div>

      {/* Operator Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         {/* Left Side: Configuration */}
         <div className="lg:col-span-4 space-y-6">
            <section className="bg-bg/40 border border-border rounded-[32px] p-6 shadow-xl">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-muted mb-6 flex items-center gap-2">
                  <Layers size={14} /> Step 1: Select Attributes
               </h3>
               
               <div className="space-y-6">
                  <div>
                     <label className="text-[9px] font-black text-muted uppercase tracking-widest block mb-3">Color Category</label>
                     <div className="grid grid-cols-2 gap-2">
                        {colors.map(c => (
                           <button 
                              key={c.color}
                              onClick={() => setSelectedColor(c.color)}
                              className={cn(
                                 "px-3 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all truncate",
                                 selectedColor === c.color 
                                    ? "bg-accent/20 border-accent text-accent shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                                    : "bg-bg2/40 border-border text-muted hover:border-muted/50"
                              )}
                           >
                              {c.color}
                           </button>
                        ))}
                     </div>
                  </div>

                  <div>
                     <label className="text-[9px] font-black text-muted uppercase tracking-widest block mb-3">Target Line</label>
                     <div className="grid grid-cols-4 gap-2">
                        {['1','2','3','4','5','6','7','8'].map(l => (
                           <button 
                              key={l}
                              onClick={() => setLineNo(l)}
                              className={cn(
                                 "w-10 h-10 rounded-xl text-[10px] font-black flex items-center justify-center border transition-all",
                                 lineNo === l 
                                    ? "bg-indigo-500 border-indigo-500 text-white shadow-lg" 
                                    : "bg-bg2/40 border-border text-muted hover:border-muted/50"
                              )}
                           >
                              {l}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </section>

            {/* Quick Stats for selected color */}
            <AnimatePresence mode="wait">
               {selectedColor && activeColorData && (
                  <motion.div 
                     key={selectedColor}
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     className="bg-bg/40 border border-border rounded-[32px] p-6 shadow-xl relative overflow-hidden"
                  >
                     <div className="flex justify-between items-end mb-4">
                        <div>
                           <span className="text-[8px] font-black text-muted uppercase block">Current Color Status</span>
                           <h4 className="text-sm font-black text-white uppercase">{selectedColor}</h4>
                        </div>
                        <span className="text-[10px] font-black text-accent">{activeColorData.input - activeColorData.output} WIP</span>
                     </div>
                     <div className="space-y-3">
                        <div className="flex justify-between text-[10px] items-center">
                           <span className="text-muted font-bold uppercase">Completion</span>
                           <span className="text-white font-black">{Math.round((activeColorData.output / activeColorData.orderQty) * 100)}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                           <div 
                              className="h-full bg-success transition-all duration-500" 
                              style={{ width: `${Math.min((activeColorData.output / activeColorData.orderQty) * 100, 100)}%` }} 
                           />
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

         {/* Right Side: Quantity Entry */}
         <div className="lg:col-span-8 flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {/* INPUT QTY CARD */}
               <section className="bg-bg2/80 border border-border rounded-[40px] p-8 shadow-2xl relative group">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                        <ArrowRightLeft size={20} className="rotate-90" />
                     </div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-white">Daily Input</h3>
                  </div>

                  <div className="flex flex-col items-center">
                     <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Pieces Received</span>
                     <div className="text-6xl font-black text-white mb-8 num tabular-nums">{inputQty}</div>
                     
                     <div className="grid grid-cols-3 gap-3 w-full">
                        {[-100, -10, -1].map(v => (
                           <button onClick={() => adjustQty('input', v)} key={v} className="py-3 bg-bg border border-border rounded-xl text-[11px] font-black text-muted hover:text-white transition-all">{v}</button>
                        ))}
                        {[1, 10, 100].map(v => (
                           <button onClick={() => adjustQty('input', v)} key={v} className="py-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-[11px] font-black text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">+{v}</button>
                        ))}
                     </div>
                  </div>
               </section>

               {/* OUTPUT QTY CARD */}
               <section className="bg-bg2/80 border border-border rounded-[40px] p-8 shadow-2xl relative group">
                  <div className="flex items-center gap-3 mb-8">
                     <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center border border-success/20 text-success">
                        <CheckCircle2 size={20} />
                     </div>
                     <h3 className="text-sm font-black uppercase tracking-widest text-white">Daily Output</h3>
                  </div>

                  <div className="flex flex-col items-center">
                     <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-2">Pieces Completed</span>
                     <div className="text-6xl font-black text-success mb-8 num tabular-nums">{outputQty}</div>
                     
                     <div className="grid grid-cols-3 gap-3 w-full">
                        {[-100, -10, -1].map(v => (
                           <button onClick={() => adjustQty('output', v)} key={v} className="py-3 bg-bg border border-border rounded-xl text-[11px] font-black text-muted hover:text-white transition-all">{v}</button>
                        ))}
                        {[1, 10, 100].map(v => (
                           <button onClick={() => adjustQty('output', v)} key={v} className="py-3 bg-success/10 border border-success/30 rounded-xl text-[11px] font-black text-success hover:bg-success hover:text-white transition-all">+{v}</button>
                        ))}
                     </div>
                  </div>
               </section>
            </div>

            {/* Error Message */}
            <AnimatePresence>
               {error && (
                  <motion.div 
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10 }}
                     className="p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3 text-danger text-xs font-black uppercase tracking-widest"
                  >
                     <AlertCircle size={18} />
                     {error}
                  </motion.div>
               )}
            </AnimatePresence>

            {/* Final Submission Button */}
            <button 
               onClick={handleSave}
               disabled={isSaving}
               className={cn(
                  "w-full py-8 rounded-[32px] text-lg font-black uppercase tracking-[0.3em] shadow-2xl transition-all relative overflow-hidden group",
                  success ? "bg-success text-white" : "bg-white text-black hover:scale-[1.02] active:scale-95"
               )}
            >
               <div className="flex items-center justify-center gap-4 relative z-10">
                  {isSaving ? (
                     <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                  ) : success ? (
                     <CheckCircle2 size={24} />
                  ) : (
                     <Save size={24} />
                  )}
                  {isSaving ? 'UPLOADING DATA...' : success ? 'RECORD SECURED' : 'CONFIRM PRODUCTION'}
               </div>
               
               {/* Sparkle effect on hover */}
               {!isSaving && !success && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
               )}
            </button>

            {/* Shift Motivation Footer */}
            <div className="flex items-center gap-4 p-6 bg-indigo-500/5 border border-indigo-500/10 rounded-3xl">
               <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
                  <Activity size={24} className="animate-pulse" />
               </div>
               <div>
                  <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Station Velocity Indicator</h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                     You are inputting records for <span className="text-white font-black">{styleName}</span> on Line <span className="text-white font-black">{lineNo}</span>. Current station WIP is <span className="text-accent font-black">{activeColorData?.input - activeColorData?.output || 0}</span>.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
