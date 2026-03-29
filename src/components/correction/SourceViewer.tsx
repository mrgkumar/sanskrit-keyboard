'use client';

import React from 'react';
import { ImageIcon, Maximize2 } from 'lucide-react';

export const SourceViewer: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-800/50 border-b border-slate-800">
        <div className="flex items-center gap-2 text-slate-300">
          <ImageIcon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-widest">Manuscript Source</span>
        </div>
        <button className="text-slate-500 hover:text-white transition-colors">
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 relative flex items-center justify-center p-12 overflow-hidden group">
        {/* Simulated high-res scan */}
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1585771724684-2626af7f2863?auto=format&fit=crop&q=80')] bg-cover opacity-20 grayscale invert" />
        
        <div className="relative z-10 w-full max-w-md aspect-[3/4] bg-orange-50/10 border border-orange-200/20 shadow-inner flex items-center justify-center backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-orange-200/20 rounded-full flex items-center justify-center mx-auto">
              <ImageIcon className="w-8 h-8 text-orange-200/40" />
            </div>
            <p className="text-orange-200/40 font-serif italic text-sm">High-Resolution Scan Area</p>
          </div>
          
          {/* Focus Box */}
          <div className="absolute top-1/4 left-1/4 w-1/2 h-12 border-2 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-500" />
        </div>

        <div className="absolute bottom-6 left-6 px-3 py-1.5 bg-slate-800/80 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-tighter backdrop-blur-md">
          Auto-Panning Enabled
        </div>
      </div>
    </div>
  );
};
