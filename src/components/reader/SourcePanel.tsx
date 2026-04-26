'use client';

import type { MantraDocument } from '@/lib/veda-book/types';

interface SourcePanelProps {
  document: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
}

export function SourcePanel({ document, documentStatus }: SourcePanelProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-stone-300/70 bg-white/60">
      <div className="border-b border-stone-300/70 px-4 py-3">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">Source Mode</div>
        <div className="mt-1 text-sm text-stone-600">
          {documentStatus === 'loading' || documentStatus === 'refreshing' ? 'Loading raw source...' : 'Original .tex source'}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <pre className="whitespace-pre-wrap break-words font-mono text-[0.95rem] leading-7 text-stone-800">
          {document?.rawTex ?? 'Open a document to view its raw source.'}
        </pre>
      </div>
    </section>
  );
}
