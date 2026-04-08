'use client';

import React from 'react';



import Link from 'next/link';
import { ChevronLeft, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4">
          <Link 
            href="/"
            className="p-2 hover:bg-slate-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors group"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="w-[1px] h-6 bg-slate-200" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Performance Audit</h1>
          <span className="px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold uppercase rounded leading-none border border-amber-100">Review Mode</span>
        </div>
        
        <div className="flex items-center gap-2 text-slate-400">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
            <BarChart3 className="w-4 h-4" />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Goal: 30m Page</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center p-8">
        <div className="w-full max-w-5xl space-y-8">
          <div className="space-y-1">
            <h2 className="text-3xl font-display font-medium text-slate-900 tracking-tight">Scholarly Performance Audit</h2>
            <p className="text-slate-500 font-serif italic text-lg">Verify the precision of your Vedic transcription before export.</p>
          </div>

          

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
            </div>

            <div className="lg:col-span-1 space-y-8">
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-6 bg-white border-t border-slate-200 text-center text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Sanskirt Keyboard • Precision Scholarly Tools
        </p>
      </footer>
    </div>
  );
}
