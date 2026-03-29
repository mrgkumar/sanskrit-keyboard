'use client';

import React from 'react';
import { VedicReferencePane } from '@/components/reference/VedicReferencePane';


import Link from 'next/link';
import { ChevronLeft, BookOpen, CheckCircle2 } from 'lucide-react';

export default function ReferencePage() {
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            href="/settings/mappings"
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="w-[1px] h-6 bg-slate-200" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Study & Transcribe</h1>
          <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold uppercase rounded leading-none border border-orange-100">Reference Mode</span>
        </div>
        
        <div className="flex items-center gap-6">
          
          <button className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-100 active:scale-95">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-tight">Finish Assignment</span>
          </button>
        </div>
      </header>

      {/* Main Split Workspace */}
      <main className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Reference */}
        <div className="w-1/2 h-full">
          <VedicReferencePane />
        </div>

        {/* Right: Typing Engine */}
        <div className="w-1/2 h-full flex flex-col gap-4">
          <div className="flex items-center gap-2 px-2 text-slate-400">
            <BookOpen className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Active Workspace</span>
          </div>
          <div className="flex-1 overflow-hidden">
            
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 bg-white border-t border-slate-200 flex justify-center text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Reference Library Sync: ACTIVE • Tap Swaras for Vedic Details
        </p>
      </footer>
    </div>
  );
}
