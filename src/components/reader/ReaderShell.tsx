'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ReaderToolbar } from './ReaderToolbar';
import { ReaderSidebar } from './ReaderSidebar';
import { MantraDocumentView } from './MantraDocumentView';
import { SourcePanel } from './SourcePanel';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { ReaderStatusBar } from './ReaderStatusBar';
import { useReaderStore } from '@/store/useReaderStore';

const themeClassName = {
  light: 'bg-stone-50 text-stone-950',
  sepia: 'bg-[#f7f0e4] text-stone-950',
  dark: 'bg-slate-950 text-slate-50',
} as const;

export function ReaderShell() {
  const searchParams = useSearchParams();
  const initialPath = searchParams.get('path') ?? undefined;
  const {
    activeDocument,
    activePath,
    diagnosticsOpen,
    documentStatus,
    loadManifest,
    manifest,
    openDocument,
    readerMode,
    setSidebarOpen,
    sidebarOpen,
    theme,
  } = useReaderStore();

  useEffect(() => {
    void loadManifest();
  }, [loadManifest]);

  useEffect(() => {
    if (!manifest?.entries.length || activePath) {
      return;
    }

    void openDocument(initialPath ?? manifest.entries[0].path);
  }, [activePath, initialPath, manifest, openDocument]);

  const currentThemeClass = themeClassName[theme];
  const splitMode = readerMode === 'split';
  const compareMode = readerMode === 'compare';

  return (
    <div className={`${currentThemeClass} min-h-dvh`}>
      <div className="flex min-h-dvh flex-col">
        <ReaderToolbar />
        <div className="flex min-h-0 flex-1">
          <aside
            className={[
              sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
              'fixed inset-y-0 left-0 z-30 mt-16 w-[22rem] max-w-[88vw] border-r border-stone-300/70 bg-inherit/95 backdrop-blur md:static md:mt-0 md:block',
            ].join(' ')}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-stone-300/70 px-4 py-3 lg:hidden">
                <span className="text-sm font-medium uppercase tracking-[0.18em] text-stone-500">Documents</span>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-md border border-stone-300/70 px-2 py-1 text-xs"
                >
                  Close
                </button>
              </div>
              <ReaderSidebar onSelectDocument={() => setSidebarOpen(false)} />
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
                    panelLabel="Original"
                  />
                  <MantraDocumentView
                    document={activeDocument}
                    documentStatus={documentStatus}
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
