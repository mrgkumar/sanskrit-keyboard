'use client';

import { getReaderPageSizeWidth, buildReaderSourceDocumentUrl } from '@/lib/veda-book/renderText';
import type { MantraDocument } from '@/lib/veda-book/types';
import { useReaderStore } from '@/store/useReaderStore';
import { readerThemeClass, readerThemeTextClass } from './readerTheme';

interface SourcePanelProps {
  document: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
}

export function SourcePanel({ document, documentStatus }: SourcePanelProps) {
  const pageSize = useReaderStore((state) => state.pageSize);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const theme = useReaderStore((state) => state.theme);
  const pageWidth = getReaderPageSizeWidth(pageSize);
  const sourceUrl = document ? buildReaderSourceDocumentUrl(document.sourceRepo, document.sourceBranch, document.sourcePath) : null;
  const titleTextClass = readerThemeTextClass(theme, 'text-stone-500', 'text-white/70');
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-600', 'text-white');
  const codeTextClass = readerThemeTextClass(theme, 'text-stone-800', 'text-white');
  const panelClass = readerThemeClass(theme, 'border-stone-300/70 bg-white/60', 'border-slate-700/80 bg-slate-950/80');
  const headerClass = readerThemeClass(theme, 'border-stone-300/70', 'border-slate-700/80');

  return (
    <section className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border ${panelClass}`}>
      <div className={`border-b px-4 py-3 ${headerClass}`}>
        <div className={`text-[0.7rem] uppercase tracking-[0.22em] ${titleTextClass}`}>Source Mode</div>
        <div className={`mt-1 text-sm ${bodyTextClass}`}>
          {documentStatus === 'loading' || documentStatus === 'refreshing' ? 'Loading raw source...' : 'Original .tex source'}
        </div>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs uppercase tracking-[0.18em] text-blue-400 underline decoration-dotted underline-offset-4 hover:text-blue-300"
          >
            Open original source document
          </a>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="mx-auto w-full" style={{ maxWidth: pageWidth }}>
          <pre
            className={`script-text-devanagari whitespace-pre-wrap break-words ${codeTextClass}`}
            data-font-preset="chandas"
            style={{ fontSize: `${fontSize}px`, lineHeight }}
          >
            {document?.rawTex ?? 'Open a document to view its raw source.'}
          </pre>
        </div>
      </div>
    </section>
  );
}
