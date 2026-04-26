'use client';

import { AlertTriangle } from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';

export function DiagnosticsPanel() {
  const { activeDocument } = useReaderStore();
  const diagnostics = activeDocument?.diagnostics ?? [];

  return (
    <section
      className="border-t border-stone-300/70 bg-white/75 px-4 py-3 backdrop-blur"
      data-testid="reader-diagnostics-panel"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
        <AlertTriangle className="h-4 w-4" />
        Diagnostics
      </div>
      <div className="mt-3 space-y-2">
        {diagnostics.length === 0 ? (
          <div className="text-sm text-stone-500">No parser diagnostics.</div>
        ) : (
          diagnostics.map((diagnostic) => (
            <div
              key={diagnostic.id}
              className="rounded-md border border-stone-300/70 bg-stone-50 px-3 py-2 text-sm text-stone-700"
            >
              <div className="font-medium uppercase tracking-[0.14em] text-stone-500">{diagnostic.level}</div>
              <div>{diagnostic.message}</div>
              {diagnostic.source ? <pre className="mt-2 overflow-auto text-xs text-stone-500">{diagnostic.source}</pre> : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
