// app/src/components/ReferenceSidePanel.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { ReferenceLibrary } from '@/components/reference/ReferenceLibrary';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

export const ReferenceSidePanel: React.FC = () => {
  const { isReferencePanelOpen, toggleReferencePanel, deletedBuffer, activeBuffer } = useFlowStore();

  return (
    <>
      {isReferencePanelOpen ? (
        <button
          type="button"
          aria-label="Close reference drawer"
          onClick={toggleReferencePanel}
          className="fixed inset-0 z-40 bg-slate-950/25 backdrop-blur-[1px] lg:hidden"
        />
      ) : null}
      <div
        className={clsx(
          'fixed right-0 top-0 z-50 h-dvh w-[min(100vw-0.75rem,24rem)] translate-x-full transform overflow-hidden border-l border-slate-200 bg-white shadow-lg transition-transform duration-300 ease-in-out sm:w-[min(100vw-1rem,28rem)] md:w-96',
          isReferencePanelOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Reference</div>
          <button
            type="button"
            onClick={toggleReferencePanel}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close reference drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Panel Content - ReferenceLibrary */}
        <div className="h-[calc(100dvh-57px)] overflow-hidden">
          <ReferenceLibrary deletedBuffer={deletedBuffer} activeBuffer={activeBuffer} />
        </div>
      </div>
    </>
  );
};
