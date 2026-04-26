'use client';

import { useEffect } from 'react';
import { ScriptText } from '@/components/ScriptText';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';
import type { MantraDocument, MantraNode } from '@/lib/veda-book/types';
import {
  collectReaderSearchHits,
  detectReaderSourceScript,
  deriveDocumentOutline,
  formatReaderDisplayText,
  getReaderPageSizeWidth,
} from '@/lib/veda-book/renderText';
import type { ReaderDisplayScript } from '@/lib/veda-book/types';
import { useReaderStore } from '@/store/useReaderStore';

interface MantraDocumentViewProps {
  document: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  displayScriptOverride?: ReaderDisplayScript;
  panelLabel?: string;
  searchHitCount?: number;
  activeSearchHitIndex?: number;
}

const renderTextNode = (
  text: string,
  sourceScript: ReturnType<typeof detectReaderSourceScript>,
  displayScript: ReaderDisplayScript,
  sanskritFontPreset: 'noto-sans' | 'chandas' | 'sampradaya' | 'sanskrit2003' | 'siddhanta',
  tamilFontPreset: 'hybrid' | 'noto-serif' | 'anek',
) => {
  const renderedText =
    displayScript === 'original'
      ? text
      : formatReaderDisplayText(text, displayScript, sourceScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
          sanskritFontPreset,
        });

  if (sourceScript === 'mixed' || sourceScript === 'unknown') {
    return <span className="whitespace-pre-wrap break-words">{renderedText}</span>;
  }

  const effectiveScript = displayScript === 'original' ? sourceScript : displayScript;

  return (
    <ScriptText
      script={effectiveScript}
      text={renderedText}
      sanskritFontPreset={sanskritFontPreset}
      tamilFontPreset={tamilFontPreset}
      className="whitespace-pre-wrap break-words"
    />
  );
};

const renderNode = (
  node: MantraNode,
  sourceScript: ReturnType<typeof detectReaderSourceScript>,
  displayScript: ReaderDisplayScript,
  sanskritFontPreset: 'noto-sans' | 'chandas' | 'sampradaya' | 'sanskrit2003' | 'siddhanta',
  tamilFontPreset: 'hybrid' | 'noto-serif' | 'anek',
) => {
  switch (node.type) {
    case 'chapter':
      return <h1 className="text-balance text-3xl font-semibold tracking-tight">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</h1>;
    case 'section':
      return <h2 className="text-2xl font-semibold tracking-tight">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</h2>;
    case 'subsection':
      return <h3 className="text-xl font-semibold tracking-tight">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</h3>;
    case 'center':
      return <div className="text-center text-lg font-medium">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</div>;
    case 'sourceRef':
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/70 px-3 py-1 text-xs uppercase tracking-[0.16em] text-stone-600">
          <span>{node.source}</span>
          <span>{renderTextNode(node.values.join(' · '), sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</span>
        </div>
      );
    case 'pageBreak':
      return <div className="my-6 border-t border-dashed border-stone-300/80" />;
    case 'warning':
      return (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {node.message}
        </div>
      );
    case 'raw':
      return <pre className="whitespace-pre-wrap text-base leading-8">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</pre>;
    case 'paragraph':
    default:
      return <p className="whitespace-pre-wrap text-lg leading-8">{renderTextNode(node.text, sourceScript, displayScript, sanskritFontPreset, tamilFontPreset)}</p>;
  }
};

export function MantraDocumentView({ document, documentStatus, displayScriptOverride, panelLabel }: MantraDocumentViewProps) {
  const displayScript = useReaderStore((state) => state.displayScript);
  const sanskritFontPreset = useReaderStore((state) => state.sanskritFontPreset);
  const tamilFontPreset = useReaderStore((state) => state.tamilFontPreset);
  const pageSize = useReaderStore((state) => state.pageSize);
  const documentSearchQuery = useReaderStore((state) => state.documentSearchQuery);
  const documentSearchActiveIndex = useReaderStore((state) => state.documentSearchActiveIndex);
  const activeDisplayScript = displayScriptOverride ?? displayScript;
  const outline = document ? deriveDocumentOutline(document.nodes) : [];
  const sourceScript = document ? detectReaderSourceScript(document.rawTex) : 'unknown';
  const pageWidth = getReaderPageSizeWidth(pageSize);
  const searchHits = document
    ? collectReaderSearchHits(document, documentSearchQuery, activeDisplayScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
        sanskritFontPreset,
      })
    : [];
  const activeSearchHit = searchHits[documentSearchActiveIndex] ?? null;

  useEffect(() => {
    const targetId = activeSearchHit?.nodeId;
    if (!targetId) {
      return;
    }

    const element = window.document.getElementById(targetId);
    element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeSearchHit?.nodeId, documentSearchActiveIndex]);

  if (!document) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-xl text-center">
          <div className="text-sm uppercase tracking-[0.18em] text-stone-500">
            {documentStatus === 'loading' || documentStatus === 'refreshing' ? 'Loading document' : 'Reader'}
          </div>
          <p className="mt-4 text-lg text-stone-600">
            Select a mantra from the sidebar to render the source document here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3"
      data-testid="reader-document-scroll"
      style={{ maxHeight: 'calc(100dvh - 9rem)' }}
    >
      <article className="mx-auto flex w-full flex-col gap-5" style={{ maxWidth: pageWidth }}>
        <header
          id="reader-document-title"
          data-reader-search-hit={searchHits.some((hit) => hit.nodeId === 'reader-document-title') ? 'true' : undefined}
          className={[
            'border-b border-stone-300/70 pb-4',
            searchHits.some((hit) => hit.nodeId === 'reader-document-title')
              ? 'rounded-xl bg-amber-50/80 p-3 ring-1 ring-amber-300/70'
              : '',
          ].join(' ')}
        >
          <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">{document.sourcePath}</div>
          {panelLabel ? (
            <div className="mt-1 text-[0.7rem] uppercase tracking-[0.22em] text-stone-400">{panelLabel}</div>
          ) : null}
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            {renderTextNode(document.title, sourceScript, activeDisplayScript, sanskritFontPreset, tamilFontPreset)}
          </h1>
          <div className="mt-2 text-sm text-stone-600">
            {document.sourceRepo} · {document.sourceBranch}
          </div>
        </header>

        {outline.length > 1 ? (
          <nav className="rounded-xl border border-stone-300/70 bg-white/60 p-3" aria-label="Document outline">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">Outline</div>
            <div className="mt-3 space-y-1">
              {outline.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className={[
                    'block w-full rounded-md px-3 py-2 text-left text-sm transition',
                    entry.level === 1
                      ? 'font-semibold text-stone-900'
                      : entry.level === 2
                        ? 'pl-5 text-stone-800'
                        : 'pl-8 text-stone-700',
                    'hover:bg-stone-100',
                  ].join(' ')}
                >
                  {renderTextNode(entry.label, sourceScript, activeDisplayScript, sanskritFontPreset, tamilFontPreset)}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        <div className="space-y-5">
          {document.nodes.map((node) => (
            <div
              key={node.id}
              id={node.id}
              data-reader-search-hit={searchHits.some((hit) => hit.nodeId === node.id) ? 'true' : undefined}
              className={[
                'space-y-2 scroll-mt-24 rounded-xl',
                searchHits.some((hit) => hit.nodeId === node.id) ? 'bg-amber-50/70 p-3 ring-1 ring-amber-300/70' : '',
              ].join(' ')}
            >
              {renderNode(node, sourceScript, activeDisplayScript, sanskritFontPreset, tamilFontPreset)}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
