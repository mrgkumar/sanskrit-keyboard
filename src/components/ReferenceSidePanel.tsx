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
    <div className={clsx(
      "fixed right-0 top-0 h-full w-96 bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out border-l border-slate-200",
      isReferencePanelOpen ? "translate-x-0" : "translate-x-full"
    )}>
      {/* Panel Header */}
      <div className="flex justify-end p-4 border-b border-slate-200">
        <button onClick={toggleReferencePanel} className="text-slate-400 hover:text-slate-600">
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Panel Content - ReferenceLibrary */}
      <div className="h-[calc(100%-65px)]"> {/* Adjust height based on header */}
        <ReferenceLibrary deletedBuffer={deletedBuffer} activeBuffer={activeBuffer} />
      </div>
    </div>
  );
};
