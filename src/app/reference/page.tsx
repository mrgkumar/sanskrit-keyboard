'use client';

import React from 'react';
import { VedicReferencePane } from '@/components/reference/VedicReferencePane';
import { ReferenceLibrary } from '@/components/reference/ReferenceLibrary';
import { useFlowStore } from '@/store/useFlowStore';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function ReferencePage() {
  const { deletedBuffer, activeBuffer } = useFlowStore();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 font-sans overflow-hidden">
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
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Reference Library</h1>
          <span className="px-2 py-1 bg-orange-50 text-orange-700 text-[10px] font-bold uppercase rounded leading-none border border-orange-100">Study Surface</span>
        </div>
        
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Browse mappings here. Editing happens in the main workspace.
        </p>
      </header>

      {/* Main Reference Workspace */}
      <main className="flex-1 overflow-hidden p-6">
        <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <div className="min-h-0">
            <VedicReferencePane />
          </div>

          <div className="min-h-0 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <ReferenceLibrary deletedBuffer={deletedBuffer} activeBuffer={activeBuffer} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-8 py-3 bg-white border-t border-slate-200 flex justify-center text-slate-400">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">
          Reference Browser: ACTIVE • Search, review, and insert when a session is open
        </p>
      </footer>
    </div>
  );
}
