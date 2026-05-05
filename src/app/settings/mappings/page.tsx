'use client';

import React from 'react';
import { MappingManager } from '@/components/settings/MappingManager';

import Link from 'next/link';
import { ChevronLeft, Keyboard } from 'lucide-react';

export default function MappingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link 
            href="/welcome"
            className="group rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-600"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="h-6 w-[1px] bg-slate-200" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">Keyboard Customization</h1>
            <span className="mt-1 inline-flex rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase leading-none text-slate-600">
              Settings
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Link href="/reference" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-lg shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95 sm:py-2">
            <Keyboard className="w-4 h-4" />
            <span className="text-xs uppercase">Open Reference Library</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-8">
          <div className="min-h-[70vh] lg:col-span-2 lg:min-h-[calc(100vh-180px)]">
            <MappingManager />
          </div>
          <div className="lg:col-span-1 space-y-8">

            <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">Read-Only Note</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                The mapping list is a reference view only. Editing and reset behavior are not implemented in the current runtime.
              </p>
              <div className="pt-2">
                <span className="text-slate-400 text-xs font-bold uppercase tracking-tight">No customization actions available</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
