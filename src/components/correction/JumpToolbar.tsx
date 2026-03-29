'use client';

import React from 'react';
import { ChevronRight, ChevronLeft, FastForward, CheckCircle2 } from 'lucide-react';

export const JumpToolbar: React.FC = () => {
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-lg">
      <div className="flex items-center gap-1">
        <button className="p-2 hover:bg-slate-50 text-slate-400 rounded-lg transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">
          Ambiguity 4 / 12
        </div>
        <button className="p-2 hover:bg-slate-50 text-slate-600 rounded-lg transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="w-[1px] h-6 bg-slate-100" />

      <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all active:scale-95 group">
        <FastForward className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-tight">Jump to Next AI Flag</span>
        <kbd className="ml-2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded border border-white/10 text-white/60 font-mono">CTRL + →</kbd>
      </button>

      <div className="flex-1" />

      <button className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-100 active:scale-95">
        <CheckCircle2 className="w-4 h-4" />
        <span className="text-xs font-bold uppercase">Ready for Audit</span>
      </button>
    </div>
  );
};
