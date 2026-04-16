'use client';

import React from 'react';
import { MappingManager } from '@/components/settings/MappingManager';

import Link from 'next/link';
import { ChevronLeft, Keyboard } from 'lucide-react';

export default function MappingsPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Link 
            href="/welcome"
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="w-[1px] h-6 bg-slate-200" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Keyboard Customization</h1>
          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase rounded leading-none border border-slate-200">Settings</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/reference" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-100 transition-all active:scale-95">
            <Keyboard className="w-4 h-4" />
            <span className="text-xs uppercase">Open Reference Library</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center p-8">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 h-[calc(100vh-180px)]">
            <MappingManager />
          </div>
          <div className="lg:col-span-1 space-y-8">

            <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Personalization Pro-Tip</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The engine automatically learns your most frequent swara sequences. You can override these learned patterns by clicking the edit icon on any mapping.
              </p>
              <div className="pt-2">
                <button className="text-blue-600 text-xs font-bold uppercase tracking-tight hover:underline">Reset to Default</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
