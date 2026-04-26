'use client';

import type React from 'react';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { ScriptText } from '@/components/ScriptText';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';
import type { MantraDocument, MantraNode } from '@/lib/veda-book/types';
import {
  buildReaderSourceDocumentUrl,
  collectReaderSearchHits,
  detectReaderSourceScript,
  deriveDocumentOutline,
  formatReaderNodeDisplayText,
  formatReaderSearchText,
  getReaderPageSizeWidth,
  normalizeReaderSearchText,
} from '@/lib/veda-book/renderText';
import type { ReaderDisplayScript } from '@/lib/veda-book/types';
import { useReaderStore } from '@/store/useReaderStore';
import { readerThemeTextClass } from './readerTheme';

interface MantraDocumentViewProps {
  document: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  displayScriptOverride?: ReaderDisplayScript;
  searchScopeDisplayScript?: ReaderDisplayScript;
  panelLabel?: string;
  searchHitCount?: number;
  activeSearchHitIndex?: number;
}

const renderTextNode = (
  text: string,
  displayScript: ReaderDisplayScript,
  sanskritFontPreset: 'noto-sans' | 'chandas' | 'sampradaya' | 'sanskrit2003' | 'siddhanta',
  tamilFontPreset: 'hybrid' | 'noto-serif' | 'anek',
  themeTextClass: string,
) => {
  const sourceScript = detectReaderSourceScript(text);
  const renderedText =
    displayScript === 'original'
      ? text
      : formatReaderNodeDisplayText(text, displayScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
          sanskritFontPreset,
        });

  if (displayScript === 'original') {
    if (sourceScript === 'mixed' || sourceScript === 'unknown') {
      return <span className={`whitespace-pre-wrap break-words ${themeTextClass}`}>{renderedText}</span>;
    }

    return (
      <ScriptText
        script={sourceScript}
        text={renderedText}
        sanskritFontPreset={sanskritFontPreset}
        tamilFontPreset={tamilFontPreset}
        className={`whitespace-pre-wrap break-words ${themeTextClass}`}
      />
    );
  }

  return (
    <ScriptText
      script={displayScript}
      text={renderedText}
      sanskritFontPreset={sanskritFontPreset}
      tamilFontPreset={tamilFontPreset}
      className={`whitespace-pre-wrap break-words ${themeTextClass}`}
    />
  );
};

const renderHighlightedTextNode = (
  text: string,
  displayScript: ReaderDisplayScript,
  sanskritFontPreset: 'noto-sans' | 'chandas' | 'sampradaya' | 'sanskrit2003' | 'siddhanta',
  tamilFontPreset: 'hybrid' | 'noto-serif' | 'anek',
  searchTokens: string[],
  themeTextClass: string,
  isDarkTheme: boolean,
) => {
  if (searchTokens.length === 0) {
    return renderTextNode(text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass);
  }

  const fragments: React.ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/\S+/g)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (cursor < start) {
      fragments.push(text.slice(cursor, start));
    }

    const sourceSlice = text.slice(start, end);
    const sourceScript = detectReaderSourceScript(sourceSlice);
    const renderedSlice =
      displayScript === 'original'
        ? sourceSlice
        : formatReaderNodeDisplayText(sourceSlice, displayScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
            sanskritFontPreset,
          });
    const normalizedSlice = normalizeReaderSearchText(renderedSlice);
    const isMatch = searchTokens.some((token) => normalizedSlice.includes(token));

    fragments.push(
      <span
        key={`${start}-${end}`}
        data-reader-search-word-hit={isMatch ? 'true' : undefined}
        className={
          isMatch
            ? isDarkTheme
              ? 'rounded-[0.15rem] bg-amber-400/25 px-0.5 py-0.5 text-white ring-1 ring-amber-300/40'
              : 'rounded-[0.15rem] bg-amber-200/70 px-0.5 py-0.5 text-amber-950 ring-1 ring-amber-400/50'
            : undefined
        }
      >
        {displayScript === 'original' ? (
          sourceScript === 'devanagari' || sourceScript === 'roman' || sourceScript === 'tamil' ? (
            <ScriptText
              script={sourceScript}
              text={renderedSlice}
              sanskritFontPreset={sanskritFontPreset}
              tamilFontPreset={tamilFontPreset}
              className={`whitespace-pre-wrap break-words ${themeTextClass}`}
            />
          ) : (
            <span className={`whitespace-pre-wrap break-words ${themeTextClass}`}>{renderedSlice}</span>
          )
        ) : (
          <ScriptText
            script={displayScript}
            text={renderedSlice}
            sanskritFontPreset={sanskritFontPreset}
            tamilFontPreset={tamilFontPreset}
            className={`whitespace-pre-wrap break-words ${themeTextClass}`}
          />
        )}
      </span>,
    );

    cursor = end;
  }

  if (cursor < text.length) {
    fragments.push(text.slice(cursor));
  }

  return fragments;
};

const renderNode = (
  node: MantraNode,
  displayScript: ReaderDisplayScript,
  sanskritFontPreset: 'noto-sans' | 'chandas' | 'sampradaya' | 'sanskrit2003' | 'siddhanta',
  tamilFontPreset: 'hybrid' | 'noto-serif' | 'anek',
  searchTokens: string[],
  highlightWords: boolean,
  themeTextClass: string,
  isDarkTheme: boolean,
) => {
  switch (node.type) {
    case 'chapter':
      return (
          <h1 className="text-balance font-semibold tracking-tight" style={{ fontSize: '1.75em', lineHeight: 1.15 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </h1>
      );
    case 'section':
      return (
        <h2 className="font-semibold tracking-tight" style={{ fontSize: '1.45em', lineHeight: 1.2 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </h2>
      );
    case 'subsection':
      return (
        <h3 className="font-semibold tracking-tight" style={{ fontSize: '1.2em', lineHeight: 1.22 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </h3>
      );
    case 'center':
      return (
        <div className="text-center font-medium" style={{ fontSize: '1.05em', lineHeight: 1.35 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </div>
      );
    case 'sourceRef':
      return (
        <div className="inline-flex items-center gap-2 rounded-full border border-stone-300/70 bg-white/70 px-3 py-1 uppercase tracking-[0.16em] text-inherit" style={{ fontSize: '0.72em' }}>
          <span>{node.source}</span>
          <span>{highlightWords ? renderHighlightedTextNode(node.values.join(' · '), displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.values.join(' · '), displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}</span>
        </div>
      );
    case 'pageBreak':
      return <div className={isDarkTheme ? 'my-6 border-t border-dashed border-slate-700/80' : 'my-6 border-t border-dashed border-stone-300/80'} />;
    case 'warning':
      return (
        <div className={isDarkTheme ? 'rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-white' : 'rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900'} style={{ fontSize: '0.92em', lineHeight: 1.45 }}>
          {node.message}
        </div>
      );
    case 'raw':
      return (
        <pre className="whitespace-pre-wrap" style={{ fontSize: '1em', lineHeight: 1.6 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </pre>
      );
    case 'paragraph':
    default:
      return (
        <p className="whitespace-pre-wrap" style={{ fontSize: '1em', lineHeight: 1.65 }}>
          {highlightWords ? renderHighlightedTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, searchTokens, themeTextClass, isDarkTheme) : renderTextNode(node.text, displayScript, sanskritFontPreset, tamilFontPreset, themeTextClass)}
        </p>
      );
  }
};

export function MantraDocumentView({
  document,
  documentStatus,
  displayScriptOverride,
  searchScopeDisplayScript,
  panelLabel,
}: MantraDocumentViewProps) {
  const scrollRegionRef = useRef<HTMLElement | null>(null);
  const sourcePath = document?.sourcePath ?? null;
  const displayScript = useReaderStore((state) => state.displayScript);
  const sanskritFontPreset = useReaderStore((state) => state.sanskritFontPreset);
  const tamilFontPreset = useReaderStore((state) => state.tamilFontPreset);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const pageSize = useReaderStore((state) => state.pageSize);
  const theme = useReaderStore((state) => state.theme);
  const documentSearchQuery = useReaderStore((state) => state.documentSearchQuery);
  const documentSearchActiveIndex = useReaderStore((state) => state.documentSearchActiveIndex);
  const lastReadPosition = useReaderStore((state) => (sourcePath ? state.lastReadPositions[sourcePath] ?? 0 : 0));
  const setLastReadPosition = useReaderStore((state) => state.setLastReadPosition);
  const deferredDocumentSearchQuery = useDeferredValue(documentSearchQuery);
  const activeDisplayScript = displayScriptOverride ?? displayScript;
  const searchDisplayScript = searchScopeDisplayScript ?? activeDisplayScript;
  const outline = document ? deriveDocumentOutline(document.nodes) : [];
  const pageWidth = getReaderPageSizeWidth(pageSize);
  const isDarkTheme = theme === 'dark';
  const mutedTextClass = readerThemeTextClass(theme, 'text-stone-500', 'text-white/70');
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-600', 'text-white');
  const titleTextClass = readerThemeTextClass(theme, 'text-stone-900', 'text-white');
  const softerTextClass = readerThemeTextClass(theme, 'text-stone-400', 'text-white/60');
  const searchTokens = useMemo(() => {
    if (!deferredDocumentSearchQuery.trim()) {
      return [] as string[];
    }

    return formatReaderSearchText(
      deferredDocumentSearchQuery,
      searchDisplayScript,
      DEFAULT_OUTPUT_TARGET_SETTINGS,
      {
        sanskritFontPreset,
      },
    )
      .split(' ')
      .filter(Boolean);
  }, [deferredDocumentSearchQuery, searchDisplayScript, sanskritFontPreset]);
  const searchHits = useMemo(
    () =>
      document
        ? collectReaderSearchHits(document, documentSearchQuery, searchDisplayScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
            sanskritFontPreset,
          })
        : [],
    [document, documentSearchQuery, searchDisplayScript, sanskritFontPreset],
  );
  const searchHitNodeIds = useMemo(() => new Set(searchHits.map((hit) => hit.nodeId)), [searchHits]);
  const activeSearchHit = searchHits[documentSearchActiveIndex] ?? null;

  useEffect(() => {
    const targetId = activeSearchHit?.nodeId;
    if (!targetId) {
      return;
    }

    const element = window.document.getElementById(targetId);
    element?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [activeSearchHit?.nodeId, documentSearchActiveIndex]);

  useEffect(() => {
    const element = scrollRegionRef.current;
    if (!element || !sourcePath) {
      return undefined;
    }

    const handleScroll = () => {
      if (element.scrollTop <= 0) {
        return;
      }

      setLastReadPosition(sourcePath, element.scrollTop);
    };

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [sourcePath, setLastReadPosition]);

  useLayoutEffect(() => {
    if (!sourcePath || documentStatus !== 'ready' || documentSearchQuery.trim() || lastReadPosition <= 0) {
      return;
    }

    let attempts = 0;
    let frame = 0;

    const restore = () => {
      const element = scrollRegionRef.current;
      if (!element) {
        return;
      }

      const hasRoomToRestore = element.scrollHeight > lastReadPosition + 8;
      if (!hasRoomToRestore && attempts < 10) {
        attempts += 1;
        frame = window.requestAnimationFrame(restore);
        return;
      }

      element.scrollTop = lastReadPosition;
    };

    frame = window.requestAnimationFrame(restore);

    return () => window.cancelAnimationFrame(frame);
  }, [documentStatus, sourcePath, documentSearchQuery, lastReadPosition]);

  if (!document) {
    return (
      <section className="flex min-h-0 flex-1 items-center justify-center px-4 py-10">
        <div className="max-w-xl text-center">
          <div className={`text-sm uppercase tracking-[0.18em] ${mutedTextClass}`}>
            {documentStatus === 'loading' || documentStatus === 'refreshing' ? 'Loading document' : 'Reader'}
          </div>
          <p className={`mt-4 text-lg ${bodyTextClass}`}>
            Select a mantra from the sidebar to render the source document here.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      key={sourcePath ?? 'reader-document'}
      className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3"
      data-testid="reader-document-scroll"
      style={{ maxHeight: 'calc(100dvh - 9rem)' }}
      ref={scrollRegionRef}
    >
      <article className="mx-auto flex w-full flex-col gap-5" style={{ maxWidth: pageWidth, fontSize: `${fontSize}px`, lineHeight }}>
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
          <div className={`text-[0.7rem] uppercase tracking-[0.22em] ${mutedTextClass}`}>{document.sourcePath}</div>
          {panelLabel ? (
            <div className={`mt-1 text-[0.7rem] uppercase tracking-[0.22em] ${softerTextClass}`}>{panelLabel}</div>
          ) : null}
          <h1 className="mt-2 font-semibold tracking-tight text-balance" style={{ fontSize: '1.8em', lineHeight: 1.1 }}>
          {searchHitNodeIds.has('reader-document-title')
            ? renderHighlightedTextNode(document.title, activeDisplayScript, sanskritFontPreset, tamilFontPreset, searchTokens, titleTextClass, isDarkTheme)
            : renderTextNode(document.title, activeDisplayScript, sanskritFontPreset, tamilFontPreset, titleTextClass)}
          </h1>
          <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${bodyTextClass}`}>
            <span>{document.sourceRepo} · {document.sourceBranch}</span>
            <a
              href={buildReaderSourceDocumentUrl(document.sourceRepo, document.sourceBranch, document.sourcePath)}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 underline decoration-dotted underline-offset-4 hover:text-blue-800"
            >
              Open source document
            </a>
          </div>
        </header>

        {outline.length > 1 ? (
          <nav className="rounded-xl border border-stone-300/70 bg-white/60 p-3" aria-label="Document outline">
            <div className={`text-[0.7rem] uppercase tracking-[0.22em] ${mutedTextClass}`}>Outline</div>
            <div className="mt-3 space-y-1">
              {outline.map((entry) => (
                <a
                  key={entry.id}
                  href={`#${entry.id}`}
                  className={[
                    'block w-full rounded-md px-3 py-2 text-left text-sm transition',
                    entry.level === 1
                      ? `font-semibold ${titleTextClass}`
                      : entry.level === 2
                        ? `pl-5 ${bodyTextClass}`
                        : `pl-8 ${bodyTextClass}`,
                    'hover:bg-stone-100',
                  ].join(' ')}
                >
                  {renderTextNode(entry.label, activeDisplayScript, sanskritFontPreset, tamilFontPreset, bodyTextClass)}
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
              {renderNode(node, activeDisplayScript, sanskritFontPreset, tamilFontPreset, searchTokens, searchHitNodeIds.has(node.id), titleTextClass, isDarkTheme)}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
