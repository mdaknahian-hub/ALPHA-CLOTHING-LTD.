import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Info, AlertCircle, CheckCircle2, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface FlowVisualizerProps {
  styleName: string;
  totalOrder: number;
  totalInput: number;
  totalOutput: number;
  colors: any[];
}

export default function FlowVisualizer({ styleName, totalOrder, totalInput, totalOutput, colors }: FlowVisualizerProps) {
  const wip = totalInput - totalOutput;
  const balance = totalOrder - totalInput;
  const completionRate = totalOrder > 0 ? (totalOutput / totalOrder) * 100 : 0;
  
  // Calculate flow widths (scaled to 100%)
  const maxVal = Math.max(totalOrder, totalInput, totalOutput);
  const getWidth = (val: number) => Math.max((val / maxVal) * 100, 2);

  const stages = [
    { id: 'order', label: 'Order Entry', val: totalOrder, color: 'bg-muted', icon: '🛒' },
    { id: 'input', label: 'Finishing Input', val: totalInput, color: 'bg-indigo-500', icon: '📥' },
    { id: 'output', label: 'Finishing Output', val: totalOutput, color: 'bg-success', icon: '📤' }
  ];

  const analysis = useMemo(() => {
    if (totalOrder === 0) return "No order data available for this style.";
    
    let text = `${styleName} Analysis: `;
    if (wip > 0) {
      text += `Currently, ${wip.toLocaleString()} pieces are in process (WIP) at the finishing station. `;
    } else {
      text += `No WIP detected at finishing lines. `;
    }

    if (balance > 0) {
      text += `There are ${balance.toLocaleString()} pieces yet to be received for finishing. `;
    }

    if (completionRate >= 100) {
      text += `Target achieved. Style is 100% complete.`;
    } else {
      text += `Achievement rate is ${Math.round(completionRate)}%. `;
    }

    return text;
  }, [styleName, totalOrder, totalInput, totalOutput, wip, balance, completionRate]);

  return (
    <div className="bg-bg2/40 border border-border rounded-[40px] p-8 shadow-2xl relative overflow-hidden backdrop-blur-3xl mb-8 group">
      <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-5 transition-opacity">
        <Activity size={120} />
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="space-y-6 flex-1">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                <Activity size={20} className="text-accent" />
             </div>
             <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Style Material Flow</h3>
                <p className="text-[10px] text-muted font-black uppercase mt-1 tracking-widest">Real-time Input/Output Mapping</p>
             </div>
          </div>

          {/* Sankey-ish Flow Visualization */}
          <div className="space-y-12 py-4">
             <div className="flex flex-wrap items-center gap-4 lg:gap-8 justify-between">
                {stages.map((stage, idx) => (
                   <React.Fragment key={stage.id}>
                      <div className="flex flex-col items-center gap-3 group/node">
                         <div className={cn(
                            "w-16 h-16 rounded-3xl flex items-center justify-center text-2xl shadow-xl ring-1 ring-white/10 relative transition-transform duration-500 group-hover/node:scale-110",
                            stage.id === 'order' ? "bg-bg border border-border" : stage.color
                         )}>
                            {stage.icon}
                            {idx < stages.length - 1 && (
                               <div className="absolute -right-4 lg:-right-8 top-1/2 -translate-y-1/2 hidden lg:flex items-center">
                                  <motion.div 
                                     animate={{ x: [0, 20, 0] }}
                                     transition={{ duration: 2, repeat: Infinity }}
                                  >
                                     <ArrowRight className="text-muted/30" size={20} />
                                  </motion.div>
                               </div>
                            )}
                         </div>
                         <div className="text-center">
                            <span className="text-[10px] font-black text-muted uppercase tracking-widest block mb-1">{stage.label}</span>
                            <span className="text-lg font-black num text-white">{stage.val.toLocaleString()}</span>
                         </div>
                      </div>
                   </React.Fragment>
                ))}

                {/* WIP Bubble */}
                <div className="flex flex-col items-center gap-3">
                   <div className="w-20 h-20 rounded-full bg-accent/10 border-2 border-dashed border-accent/30 flex items-center justify-center flex-col shadow-[0_0_30px_rgba(245,158,11,0.1)] relative">
                      <motion.div 
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="text-center"
                      >
                         <span className="text-[9px] font-black text-accent uppercase tracking-widest">WIP</span>
                         <div className="text-lg font-black num text-accent leading-none">{wip.toLocaleString()}</div>
                      </motion.div>
                   </div>
                   <span className="text-[10px] font-black text-muted uppercase tracking-widest">Pending Flow</span>
                </div>
             </div>

             {/* Flow Ribbons (Visual connection) */}
             <div className="relative h-20 bg-bg/40 rounded-3xl border border-border overflow-hidden">
                <div className="absolute inset-0 flex">
                   {/* Order to Input */}
                   <div className="h-full bg-indigo-500/20 border-r border-indigo-500/10 relative overflow-hidden" style={{ width: '40%' }}>
                      <motion.div 
                        initial={{ left: '-20%' }}
                        animate={{ left: '100%' }}
                        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                        className="absolute top-0 bottom-0 w-8 bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent skew-x-12"
                      />
                   </div>
                   {/* Input to Output */}
                   <div className="h-full bg-success/20 relative overflow-hidden" style={{ width: '60%' }}>
                      <motion.div 
                        initial={{ left: '-20%' }}
                        animate={{ left: '100%' }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                        className="absolute top-0 bottom-0 w-12 bg-gradient-to-r from-transparent via-success/30 to-transparent skew-x-12"
                      />
                      {/* WIP indication inside the flow */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                         <div className="text-[40px] font-black uppercase tracking-[1em]">PROCESSING DATA</div>
                      </div>
                   </div>
                </div>
                
                {/* Horizontal Scale markers */}
                <div className="absolute inset-0 flex items-center px-8 pointer-events-none">
                   <div className="h-0.5 w-full bg-white/5 relative">
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-muted" title="Order Start" />
                      <div className="absolute left-[40%] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" title="Finishing Input" />
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-success shadow-[0_0_15px_rgba(34,197,94,0.5)]" title="Style Completion" />
                   </div>
                </div>
             </div>
          </div>
        </div>

        {/* Textual Analysis & WIP Status */}
        <div className="lg:w-80 space-y-4">
           <div className="bg-bg/60 border border-border rounded-3xl p-6 shadow-xl relative group">
              <div className="flex items-center gap-2 mb-4">
                 {wip > 100 ? (
                    <AlertCircle size={16} className="text-accent animate-pulse" />
                 ) : (
                    <CheckCircle2 size={16} className="text-success" />
                 )}
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-white">Diagnostics Summary</h4>
              </div>
              <p className="text-[12px] leading-relaxed text-muted-foreground font-medium">
                 {analysis}
              </p>
              
              <div className="mt-6 pt-6 border-t border-border/50">
                 <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-bold text-muted uppercase">Execution Ratio</span>
                       <span className="text-[11px] font-black num text-white">{Math.round(completionRate)}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                       <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${Math.min(completionRate, 100)}%` }} />
                    </div>
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-3 p-4 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                 <Info size={16} />
              </div>
              <p className="text-[9px] text-muted-foreground leading-snug">
                 <span className="font-bold text-white uppercase block mb-1">Process Logic</span>
                 Input minus Output equals station Work-In-Progress (WIP).
              </p>
           </div>
        </div>
      </div>
    </div>
  );
}
