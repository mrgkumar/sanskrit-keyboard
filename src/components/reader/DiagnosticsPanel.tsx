'use client';

import { AlertTriangle } from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';

export function DiagnosticsPanel() {
  const activeDocument = useReaderStore((state) => state.activeDocument);
  const diagnostics = activeDocument?.diagnostics ?? [];
  const counts = diagnostics.reduce(
    (accumulator, diagnostic) => {
      accumulator[diagnostic.level] += 1;
      return accumulator;
    },
    { info: 0, warning: 0, error: 0 },
  );

  return (
    <section
      className="border-t border-stone-300/70 bg-white/75 px-4 py-3 backdrop-blur"
      data-testid="reader-diagnostics-panel"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-stone-800">
        <AlertTriangle className="h-4 w-4" />
        Diagnostics
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] text-stone-500">
        <span className="rounded-full border border-stone-300/70 bg-white/70 px-2 py-1">Info {counts.info}</span>
        <span className="rounded-full border border-stone-300/70 bg-white/70 px-2 py-1">Warnings {counts.warning}</span>
        <span className="rounded-full border border-stone-300/70 bg-white/70 px-2 py-1">Errors {counts.error}</span>
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
              <div className="flex flex-wrap items-center gap-2 font-medium uppercase tracking-[0.14em] text-stone-500">
                <span>{diagnostic.level}</span>
                {diagnostic.line ? (
                  <span className="rounded-full border border-stone-300/70 bg-white/70 px-2 py-0.5 text-[0.65rem] tracking-[0.18em]">
                    L{diagnostic.line}
                    {diagnostic.column ? `:${diagnostic.column}` : ''}
                  </span>
                ) : null}
                {diagnostic.nodeId ? (
                  <button
                    type="button"
                    data-testid="diagnostic-jump"
                    onClick={() => {
                      const target = document.getElementById(diagnostic.nodeId!);
                      target?.scrollIntoView({ block: 'center', behavior: 'instant' });
                    }}
                    className="rounded-full border border-stone-300/70 bg-white/80 px-2 py-0.5 text-[0.65rem] tracking-[0.18em] text-stone-700 transition hover:bg-white"
                  >
                    Jump to source
                  </button>
                ) : null}
              </div>
              <div>{diagnostic.message}</div>
              {diagnostic.source ? (
                <pre className="mt-2 overflow-auto text-xs text-stone-500">{diagnostic.source}</pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
