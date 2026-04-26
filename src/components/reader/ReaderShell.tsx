'use client';

import { useDeferredValue, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSearchResults } from './ReaderSearchResults';
import { ReaderSidebar } from './ReaderSidebar';
import { MantraDocumentView } from './MantraDocumentView';
import { SourcePanel } from './SourcePanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ReaderStatusBar } from './ReaderStatusBar';
import { readerThemeTextClass } from './readerTheme';
import { useReaderStore } from '@/store/useReaderStore';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';
import { collectReaderSearchHits } from '@/lib/veda-book/renderText';

const themeClassName = {
  light: 'bg-stone-50 text-stone-950',
  sepia: 'bg-[#f7f0e4] text-stone-950',
  dark: 'bg-slate-950 text-slate-50',
} as const;

export function ReaderShell() {
  const searchParams = useSearchParams();
  const initialPath = searchParams.get('path') ?? undefined;
  const activeDocument = useReaderStore((state) => state.activeDocument);
  const activePath = useReaderStore((state) => state.activePath);
  const diagnosticsOpen = useReaderStore((state) => state.diagnosticsOpen);
  const documentStatus = useReaderStore((state) => state.documentStatus);
  const loadManifest = useReaderStore((state) => state.loadManifest);
  const manifest = useReaderStore((state) => state.manifest);
  const openDocument = useReaderStore((state) => state.openDocument);
  const readerMode = useReaderStore((state) => state.readerMode);
  const documentSearchQuery = useReaderStore((state) => state.documentSearchQuery);
  const documentSearchActiveIndex = useReaderStore((state) => state.documentSearchActiveIndex);
  const documentSearchOpen = useReaderStore((state) => state.documentSearchOpen);
  const displayScript = useReaderStore((state) => state.displayScript);
  const sanskritFontPreset = useReaderStore((state) => state.sanskritFontPreset);
  const tamilFontPreset = useReaderStore((state) => state.tamilFontPreset);
  const setDocumentSearchOpen = useReaderStore((state) => state.setDocumentSearchOpen);
  const setDocumentSearchActiveIndex = useReaderStore((state) => state.setDocumentSearchActiveIndex);
  const setDocumentSearchQuery = useReaderStore((state) => state.setDocumentSearchQuery);
  const setSidebarOpen = useReaderStore((state) => state.setSidebarOpen);
  const setSidebarCollapsed = useReaderStore((state) => state.setSidebarCollapsed);
  const sidebarOpen = useReaderStore((state) => state.sidebarOpen);
  const sidebarCollapsed = useReaderStore((state) => state.sidebarCollapsed);
  const theme = useReaderStore((state) => state.theme);
  const deferredDocumentSearchQuery = useDeferredValue(documentSearchQuery);
  const lastEscapeAtRef = useRef(0);
  const mutedTextClass = readerThemeTextClass(theme, 'text-stone-500', 'text-white/70');
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-700', 'text-white');

  useEffect(() => {
    if (documentSearchOpen) {
      lastEscapeAtRef.current = 0;
    }
  }, [documentSearchOpen]);

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!manifest?.entries.length || activePath) {
      return;
    }

    const preferredEntry =
      manifest.entries.find((entry) => entry.path === 'mantras/PurushaSuktam.tex') ??
      manifest.entries.find((entry) => entry.path !== 'mantras.tex') ??
      manifest.entries[0];
    void openDocument(initialPath ?? preferredEntry?.path ?? manifest.entries[0].path);
  }, [activePath, initialPath, manifest, openDocument]);

  const currentThemeClass = themeClassName[theme];
  const splitMode = readerMode === 'split';
  const compareMode = readerMode === 'compare';

  useEffect(() => {
    if (!manifest) {
      return;
    }

    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer !== null) {
        return;
      }

      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadManifest({ force: true });
      }, 0);
    };

    const handleFocus = () => {
      scheduleRefresh();
    };

    const handleVisibilityChange = () => {
      scheduleRefresh();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, [loadManifest, manifest]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setDocumentSearchOpen(true);
      }

      if (event.key === 'Escape') {
        const now = performance.now();
        const isDoubleEscape = now - lastEscapeAtRef.current < 500;
        lastEscapeAtRef.current = now;

        if (isDoubleEscape) {
          setDocumentSearchQuery('');
          setDocumentSearchActiveIndex(0);
          setDocumentSearchOpen(false);
          return;
        }

        setDocumentSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setDocumentSearchActiveIndex, setDocumentSearchOpen, setDocumentSearchQuery]);

  const documentSearchHits = useMemo(() => {
    if (!activeDocument || !deferredDocumentSearchQuery.trim()) {
      return [];
    }

    return collectReaderSearchHits(activeDocument, deferredDocumentSearchQuery, displayScript, DEFAULT_OUTPUT_TARGET_SETTINGS, {
      sanskritFontPreset,
    });
  }, [activeDocument, deferredDocumentSearchQuery, displayScript, sanskritFontPreset]);

  const goToPreviousSearchHit = () => {
    if (documentSearchHits.length === 0) {
      return;
    }

    setDocumentSearchActiveIndex((documentSearchActiveIndex - 1 + documentSearchHits.length) % documentSearchHits.length);
  };

  const goToNextSearchHit = () => {
    if (documentSearchHits.length === 0) {
      return;
    }

    setDocumentSearchActiveIndex((documentSearchActiveIndex + 1) % documentSearchHits.length);
  };

  return (
    <div className={`${currentThemeClass} min-h-dvh`}>
      <div className="flex min-h-dvh flex-col">
        <ReaderToolbar documentSearchHitCount={documentSearchHits.length} />
        <ReaderSearchResults
          open={documentSearchOpen}
          query={documentSearchQuery}
          hitCount={documentSearchHits.length}
          activeIndex={documentSearchActiveIndex}
          displayScript={displayScript}
          sanskritFontPreset={sanskritFontPreset}
          tamilFontPreset={tamilFontPreset}
          onChangeQuery={setDocumentSearchQuery}
          onPreviousHit={goToPreviousSearchHit}
          onNextHit={goToNextSearchHit}
          onClose={() => setDocumentSearchOpen(false)}
        />
        <div className="flex min-h-0 flex-1">
          <aside
            className={[
              sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
              sidebarCollapsed ? 'md:w-[4.25rem]' : 'md:w-[22rem]',
              'fixed inset-y-0 left-0 z-30 mt-16 w-[22rem] max-w-[88vw] overflow-hidden border-r border-stone-300/70 bg-inherit/95 backdrop-blur transition-[width,transform] duration-200 md:static md:mt-0 md:block md:max-w-none',
            ].join(' ')}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between gap-2 border-b border-stone-300/70 px-3 py-3">
                <span
                  className={[
                    `text-sm font-medium uppercase tracking-[0.18em] ${mutedTextClass} transition-opacity`,
                    sidebarCollapsed ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100',
                  ].join(' ')}
                >
                  Documents
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                    className={`hidden rounded-md border border-stone-300/70 bg-white/70 px-2 py-1 text-xs ${bodyTextClass} transition hover:bg-white md:inline-flex`}
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  >
                    {sidebarCollapsed ? 'Expand' : 'Collapse'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="rounded-md border border-stone-300/70 px-2 py-1 text-xs lg:hidden"
                  >
                    Close
                  </button>
                </div>
              </div>
              <ReaderSidebar
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
                onSelectDocument={() => setSidebarOpen(false)}
              />
            </div>
          </aside>
          {sidebarOpen ? (
            <button
              type="button"
              aria-label="Close sidebar overlay"
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-20 bg-black/25 lg:hidden"
            />
          ) : null}

          <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {readerMode === 'source' ? (
                <SourcePanel document={activeDocument} documentStatus={documentStatus} />
              ) : compareMode ? (
                <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 pt-3 lg:grid-cols-2">
                  <MantraDocumentView
                    document={activeDocument}
                    documentStatus={documentStatus}
                    displayScriptOverride="original"
                    searchScopeDisplayScript={displayScript}
                    panelLabel="Original"
                  />
                  <MantraDocumentView
                    document={activeDocument}
                    documentStatus={documentStatus}
                    searchScopeDisplayScript={displayScript}
                    panelLabel="Selected display"
                  />
                </div>
              ) : splitMode ? (
                <div className="grid min-h-0 flex-1 gap-4 px-4 pb-4 pt-3 lg:grid-cols-2">
                  <MantraDocumentView document={activeDocument} documentStatus={documentStatus} />
                  <SourcePanel document={activeDocument} documentStatus={documentStatus} />
                </div>
              ) : (
                <MantraDocumentView document={activeDocument} documentStatus={documentStatus} />
              )}
            </div>

            {diagnosticsOpen ? <DiagnosticsPanel /> : null}
            <ReaderStatusBar />
          </main>
        </div>
      </div>
    </div>
  );
}
