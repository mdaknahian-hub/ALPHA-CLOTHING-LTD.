import React, { useState, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';

interface AgentFaceProps {
  expression: 'neutral' | 'happy' | 'sad' | 'thinking';
  size?: number;
}

export const AgentFace: React.FC<AgentFaceProps> = ({ expression = 'neutral', size = 28 }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized mouse position (-1 to 1) relative to screen center
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Pupil movement range
  const pupilX = mousePos.x * 8;
  const pupilY = mousePos.y * 8;

  const mouthPaths = {
    neutral: "M 20 60 Q 50 95 80 60 Q 50 80 20 60", // wide open smile
    happy: "M 20 60 Q 50 95 80 60 Q 50 80 20 60", // wide open smile
    sad: "M 20 60 Q 50 95 80 60 Q 50 80 20 60", // wide open smile
    thinking: "M 20 60 Q 50 95 80 60 Q 50 80 20 60", // wide open smile
  };

  const eyeYOffset = expression === 'sad' ? 3 : expression === 'happy' ? -2 : 0;

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-xl"
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* 3D Face Gradient */}
        <radialGradient id="faceGradient" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFF06A" />
          <stop offset="50%" stopColor="#FFD500" />
          <stop offset="100%" stopColor="#E6A800" />
        </radialGradient>

        <radialGradient id="eyeBlueGradient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="70%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </radialGradient>
      </defs>

      {/* Face Base */}
      <circle cx="50" cy="50" r="48" fill="url(#faceGradient)" />
      
      {/* Left Eye Base (Huge!) */}
      <ellipse cx="32" cy={40 + eyeYOffset} rx="26" ry="32" fill="white" />
      {/* Right Eye Base (Huge!) */}
      <ellipse cx="68" cy={40 + eyeYOffset} rx="26" ry="32" fill="white" />
      
      {/* Left Iris (Blue) */}
      <motion.g animate={{ x: pupilX, y: pupilY }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
        <circle cx="32" cy={40 + eyeYOffset} r="15" fill="url(#eyeBlueGradient)" />
        <circle cx="32" cy={40 + eyeYOffset} r="9" fill="#0F172A" />
        <circle cx="36" cy={35 + eyeYOffset} r="4" fill="white" /> {/* Catchlight */}
      </motion.g>
      
      {/* Right Iris (Blue) */}
      <motion.g animate={{ x: pupilX, y: pupilY }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
        <circle cx="68" cy={40 + eyeYOffset} r="15" fill="url(#eyeBlueGradient)" />
        <circle cx="68" cy={40 + eyeYOffset} r="9" fill="#0F172A" />
        <circle cx="72" cy={35 + eyeYOffset} r="4" fill="white" /> {/* Catchlight */}
      </motion.g>

      {/* Eyebrows */}
      {expression === 'thinking' && (
        <g stroke="#92400E" strokeWidth="5" strokeLinecap="round">
          <line x1="20" y1="18" x2="44" y2="25" />
          <line x1="56" y1="25" x2="80" y2="18" />
        </g>
      )}

      {expression === 'sad' && (
        <g stroke="#92400E" strokeWidth="5" strokeLinecap="round">
          <line x1="20" y1="25" x2="44" y2="18" />
          <line x1="56" y1="18" x2="80" y2="25" />
        </g>
      )}

      {expression === 'happy' && (
        <g stroke="#92400E" strokeWidth="5" strokeLinecap="round">
          <path d="M 18 20 Q 32 10 46 20" fill="none" />
          <path d="M 54 20 Q 68 10 82 20" fill="none" />
        </g>
      )}

      {expression === 'neutral' && (
        <g stroke="#92400E" strokeWidth="5" strokeLinecap="round">
          <path d="M 20 22 Q 32 16 44 22" fill="none" />
          <path d="M 56 22 Q 68 16 80 22" fill="none" />
        </g>
      )}

      {/* Mouth */}
      <motion.path 
        d={mouthPaths[expression]} 
        fill={expression === 'happy' ? "#7F1D1D" : "transparent"}
        stroke="#7F1D1D" 
        strokeWidth={expression === 'happy' ? "2" : "5"} 
        strokeLinecap="round"
        animate={{ d: mouthPaths[expression] }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      />
      {expression === 'happy' && (
         <motion.path 
            d="M 22 62 Q 50 72 78 62 Q 50 68 22 62" 
            fill="white" 
            opacity="0.9"
         />
      )}
    </svg>
  );
};
