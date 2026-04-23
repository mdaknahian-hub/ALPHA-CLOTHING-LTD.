import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  unit?: string;
  color?: string;
}

export default function Gauge({ value, max, label, unit = '%', color = '#f59e0b' }: GaugeProps) {
  const controls = useAnimation();
  const [displayValue, setDisplayValue] = useState(0);

  const percentage = Math.min((value / max) * 100, 100);
  const rotation = (percentage / 100) * 240 - 120; // -120 to +120 degrees for a semi-circular look

  const runAnimation = async () => {
    // 1. Reset to 0
    await controls.start({ rotate: -120, transition: { duration: 0.3, ease: "easeOut" } });
    
    // 2. Sweep to Top (120)
    await controls.start({ rotate: 120, transition: { duration: 1.2, ease: "easeInOut" } });
    
    // 3. Back to Target
    await controls.start({ rotate: rotation, transition: { duration: 0.8, ease: "backOut" } });
  };

  useEffect(() => {
    runAnimation();
    
    // Animate display value
    let start = 0;
    const duration = 2.3; // Total animation time roughly
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      
      // Simpler linear count for now
      setDisplayValue(Math.floor(progress * value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, rotation]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-32 flex flex-col items-center justify-end overflow-hidden">
        {/* Gauge Body */}
        <svg viewBox="0 0 100 60" className="w-full h-full">
          {/* Background Path */}
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Ticks */}
          {[...Array(11)].map((_, i) => {
            const angle = (i * 24) - 120; // -120 to 120
            const rad = (angle * Math.PI) / 180;
            const x1 = 50 + Math.cos(rad) * 35;
            const y1 = 50 + Math.sin(rad) * 35;
            const x2 = 50 + Math.cos(rad) * 42;
            const y2 = 50 + Math.sin(rad) * 42;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i > 8 ? '#ef4444' : 'rgba(255,255,255,0.2)'}
                strokeWidth={i % 5 === 0 ? 1 : 0.5}
              />
            );
          })}
        </svg>

        {/* Needle Container */}
        <motion.div
          animate={controls}
          initial={{ rotate: -120 }}
          style={{ originX: '50%', originY: '100%' }}
          className="absolute bottom-5 left-[50%] w-0.5 h-16 -ml-[1px] z-20 pointer-events-none"
        >
          {/* Needle Base Pin */}
          <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-accent rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-white/20" />
          
          {/* Needle Shaft */}
          <div className="w-full h-full bg-gradient-to-t from-accent via-accent to-danger rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        </motion.div>

        {/* Lighting Glow (Car style) */}
        <div className="absolute inset-0 bg-gradient-to-t from-accent/5 to-transparent pointer-events-none" />
      </div>

      <div className="mt-2 text-center">
        <div className="text-2xl font-black num tracking-tighter">
          {displayValue}{unit}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted flex items-center justify-center gap-2">
          {label}
          <button onClick={runAnimation} className="hover:text-accent transition-colors active:rotate-180 duration-500">
            <RefreshCw size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
