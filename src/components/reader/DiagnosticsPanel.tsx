'use client';

import { AlertTriangle } from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';
import { readerThemeClass, readerThemeTextClass } from './readerTheme';

export function DiagnosticsPanel() {
  const activeDocument = useReaderStore((state) => state.activeDocument);
  const theme = useReaderStore((state) => state.theme);
  const diagnostics = activeDocument?.diagnostics ?? [];
  const mutedTextClass = readerThemeTextClass(theme, 'text-stone-500', 'text-white/70');
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-700');
  const titleTextClass = readerThemeTextClass(theme, 'text-stone-800');
  const panelClass = readerThemeClass(theme, 'border-stone-300/70 bg-white/75', 'border-slate-700/80 bg-slate-950/80');
  const badgeClass = readerThemeClass(theme, 'border-stone-300/70 bg-white/70', 'border-slate-700/80 bg-slate-900/80');
  const itemClass = readerThemeClass(theme, 'border-stone-300/70 bg-stone-50', 'border-slate-700/80 bg-slate-900/60');
  const counts = diagnostics.reduce(
    (accumulator, diagnostic) => {
      accumulator[diagnostic.level] += 1;
      return accumulator;
    },
    { info: 0, warning: 0, error: 0 },
  );

  return (
    <section
      className={`border-t px-4 py-3 backdrop-blur ${panelClass}`}
      data-testid="reader-diagnostics-panel"
    >
      <div className={`flex items-center gap-2 text-sm font-medium ${titleTextClass}`}>
        <AlertTriangle className="h-4 w-4" />
        Diagnostics
      </div>
      <div className={`mt-2 flex flex-wrap gap-2 text-xs uppercase tracking-[0.14em] ${mutedTextClass}`}>
        <span className={`rounded-full border px-2 py-1 ${badgeClass}`}>Info {counts.info}</span>
        <span className={`rounded-full border px-2 py-1 ${badgeClass}`}>Warnings {counts.warning}</span>
        <span className={`rounded-full border px-2 py-1 ${badgeClass}`}>Errors {counts.error}</span>
      </div>
      <div className="mt-3 space-y-2">
        {diagnostics.length === 0 ? (
          <div className={`text-sm ${mutedTextClass}`}>No parser diagnostics.</div>
        ) : (
          diagnostics.map((diagnostic) => (
            <div
              key={diagnostic.id}
              className={`rounded-md border px-3 py-2 text-sm ${bodyTextClass} ${itemClass}`}
            >
              <div className={`flex flex-wrap items-center gap-2 font-medium uppercase tracking-[0.14em] ${mutedTextClass}`}>
                <span>{diagnostic.level}</span>
                {diagnostic.line ? (
                  <span className={`rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] text-inherit ${badgeClass}`}>
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
                    className={`rounded-full border px-2 py-0.5 text-[0.65rem] tracking-[0.18em] text-inherit transition hover:bg-white ${badgeClass}`}
                  >
                    Jump to source
                  </button>
                ) : null}
              </div>
              <div>{diagnostic.message}</div>
              {diagnostic.source ? (
                <pre className={`mt-2 overflow-auto text-xs ${mutedTextClass}`}>{diagnostic.source}</pre>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
