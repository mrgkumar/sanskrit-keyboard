'use client';

import React from 'react';
import { BookOpen, Info, Copy } from 'lucide-react';

export const VedicReferencePane: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-orange-50/30 rounded-3xl overflow-hidden border border-orange-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-orange-100">
        <div className="flex items-center gap-2 text-orange-800 font-bold">
          <BookOpen className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest">Authoritative Vedic Source</span>
        </div>
        <div className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-bold rounded uppercase">Rigveda Samhita</div>
      </div>
      
      <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
        <div className="text-4xl font-serif leading-[2] text-slate-800 whitespace-pre-wrap">
          ॐ स॒ह ना॑ववतु। स॒ह नौ॑ भुनक्तु। स॒ह वी॒र्यं॑ करवावहै ।<br />
          ते॒ज॒स्विना॒वधी॑तमस्तु॒ मा वि॑द्विषा॒वहै᳚ ॥<br />
          <span className="relative inline-block px-1 group cursor-help">
            शान्तिः॒
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 p-3 bg-slate-900 text-white text-[10px] font-sans font-bold leading-normal rounded-xl shadow-xl z-50 hidden group-hover:block animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-1.5 mb-1 text-blue-400">
                <Info className="w-3 h-3" />
                <span className="uppercase tracking-tighter">Vedic Detail</span>
              </div>
              Anudatta swara on final syllable. Rule: 8.4.66.
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1.5 text-emerald-400">
                <Copy className="w-3 h-3" />
                <span>Tap to Quick-Copy</span>
              </div>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
            </div>
          </span>
          शान्तिः॒ शान्तिः॑ ॥
        </div>
      </div>

      <div className="px-6 py-3 bg-white/50 border-t border-orange-100 flex justify-center text-[10px] font-bold text-orange-400 uppercase tracking-[0.2em]">
        Scroll Sync: Locked to Editor
      </div>
    </div>
  );
};
