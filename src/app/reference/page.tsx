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
    <div className="flex min-h-screen flex-col overflow-hidden bg-slate-50 font-sans">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/settings/mappings"
            className="group rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-blue-600"
          >
            <ChevronLeft className="w-5 h-5 group-active:scale-90 transition-transform" />
          </Link>
          <div className="h-6 w-[1px] bg-slate-200" />
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">Reference Library</h1>
            <span className="mt-1 inline-flex rounded border border-orange-100 bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase leading-none text-orange-700">
              Study Surface
            </span>
          </div>
        </div>
        
        <p className="max-w-xl text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:text-right">
          Browse mappings here. Editing happens in the main workspace.
        </p>
      </header>

      {/* Main Reference Workspace */}
      <main className="flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="grid h-full min-h-0 gap-4 lg:grid-cols-[0.9fr_1.4fr] lg:gap-6">
          <div className="min-h-0">
            <VedicReferencePane />
          </div>

          <div className="min-h-0 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <ReferenceLibrary deletedBuffer={deletedBuffer} activeBuffer={activeBuffer} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="flex justify-center border-t border-slate-200 bg-white px-4 py-3 text-slate-400 sm:px-6 lg:px-8">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em]">
          Reference Browser: ACTIVE • Search, review, and insert when a session is open
        </p>
      </footer>
    </div>
  );
}
