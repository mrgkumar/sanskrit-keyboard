'use client';

import React from 'react';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function WelcomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-100/30 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-100/20 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <header className="flex flex-col items-center pt-16 pb-8 shrink-0 relative z-10">
        <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
          <span className="text-white font-bold text-3xl">S</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome to Sanskirt Keyboard</h1>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">The Invisible Interface</p>
      </header>

      {/* Main Tutor Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-8 relative z-10">
        
      </main>

      {/* Footer Navigation */}
      <footer className="px-8 py-12 flex justify-center relative z-10">
        <Link 
          href="/settings/mappings"
          className="flex items-center gap-2 px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-2xl transition-all active:scale-95 group"
        >
          <span>Complete Onboarding</span>
          <Sparkles className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
        </Link>
      </footer>
    </div>
  );
}
