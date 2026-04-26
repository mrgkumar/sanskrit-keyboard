'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BookOpenText,
  Copy,
  FileText,
  ChevronLeft,
  ChevronRight,
  Languages,
  Menu,
  RefreshCw,
  Search,
  SplitSquareHorizontal,
  SunMoon,
  Minus,
  Plus,
} from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';
import type { ReaderDisplayScript, ReaderMode } from '@/lib/veda-book/types';
import { getReaderDisplayScriptLabel, serializeReaderDocumentText } from '@/lib/veda-book/renderText';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

const modeOptions: Array<{ mode: ReaderMode; label: string; icon: ReactNode }> = [
  { mode: 'reader', label: 'Reader', icon: <BookOpenText className="h-4 w-4" /> },
  { mode: 'compare', label: 'Compare', icon: <Languages className="h-4 w-4" /> },
  { mode: 'source', label: 'Source', icon: <FileText className="h-4 w-4" /> },
  { mode: 'split', label: 'Split', icon: <SplitSquareHorizontal className="h-4 w-4" /> },
];

const displayScriptOptions: ReaderDisplayScript[] = ['original', 'devanagari', 'roman', 'tamil'];
const themeOrder = ['sepia', 'light', 'dark'] as const;
const sanskritFontOptions: Array<{ value: SanskritFontPreset; label: string }> = [
  { value: 'siddhanta', label: 'Siddhanta' },
  { value: 'noto-sans', label: 'Noto Sans' },
  { value: 'chandas', label: 'Chandas' },
  { value: 'sampradaya', label: 'Sampradaya' },
  { value: 'sanskrit2003', label: 'Sanskrit 2003' },
];
const tamilFontOptions: Array<{ value: TamilFontPreset; label: string }> = [
  { value: 'anek', label: 'Anek' },
  { value: 'noto-serif', label: 'Noto Serif' },
  { value: 'hybrid', label: 'Hybrid' },
];

interface ReaderToolbarProps {
  documentSearchHitCount?: number;
}

export function ReaderToolbar({ documentSearchHitCount = 0 }: ReaderToolbarProps) {
  const activeDocument = useReaderStore((state) => state.activeDocument);
  const displayScript = useReaderStore((state) => state.displayScript);
  const diagnosticsOpen = useReaderStore((state) => state.diagnosticsOpen);
  const documentSearchActiveIndex = useReaderStore((state) => state.documentSearchActiveIndex);
  const documentSearchQuery = useReaderStore((state) => state.documentSearchQuery);
  const fontSize = useReaderStore((state) => state.fontSize);
  const loadManifest = useReaderStore((state) => state.loadManifest);
  const readerMode = useReaderStore((state) => state.readerMode);
  const sanskritFontPreset = useReaderStore((state) => state.sanskritFontPreset);
  const tamilFontPreset = useReaderStore((state) => state.tamilFontPreset);
  const setSanskritFontPreset = useReaderStore((state) => state.setSanskritFontPreset);
  const setTamilFontPreset = useReaderStore((state) => state.setTamilFontPreset);
  const setDisplayScript = useReaderStore((state) => state.setDisplayScript);
  const setDiagnosticsOpen = useReaderStore((state) => state.setDiagnosticsOpen);
  const setReaderMode = useReaderStore((state) => state.setReaderMode);
  const setSidebarOpen = useReaderStore((state) => state.setSidebarOpen);
  const setTheme = useReaderStore((state) => state.setTheme);
  const setTypography = useReaderStore((state) => state.setTypography);
  const setDocumentSearchActiveIndex = useReaderStore((state) => state.setDocumentSearchActiveIndex);
  const setDocumentSearchQuery = useReaderStore((state) => state.setDocumentSearchQuery);
  const sidebarOpen = useReaderStore((state) => state.sidebarOpen);
  const theme = useReaderStore((state) => state.theme);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const currentThemeIndex = themeOrder.indexOf(theme);
  const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];
  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy text';
  const hasDocumentSearchHits = documentSearchHitCount > 0;
  const activeDocumentSearchIndex = hasDocumentSearchHits ? Math.min(documentSearchActiveIndex, documentSearchHitCount - 1) + 1 : 0;

  useEffect(() => {
    if (copyStatus !== 'copied') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyStatus('idle'), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  const handleCopyText = async () => {
    if (!activeDocument) {
      return;
    }

    const text = serializeReaderDocumentText(activeDocument, displayScript, {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-300/70 bg-inherit/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2 px-3 py-3">
        <div className="flex items-center gap-2 pr-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/60 shadow-sm transition hover:bg-white"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.22em] text-stone-500">Veda Reader</div>
            <div className="text-sm font-medium text-stone-900">GitHub Pages source reader</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {modeOptions.map((option) => {
            const active = readerMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setReaderMode(option.mode)}
                className={[
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                  active
                    ? 'border-stone-900 bg-stone-900 text-stone-50'
                    : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
                ].join(' ')}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-300/70 bg-white/55 px-2 py-1">
          <Languages className="h-4 w-4 text-stone-500" />
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Display</span>
          <div className="flex flex-wrap gap-1">
            {displayScriptOptions.map((script) => {
              const active = displayScript === script;
              return (
                <button
                  key={script}
                  type="button"
                  onClick={() => setDisplayScript(script)}
                  className={[
                    'rounded-md border px-2 py-1 text-xs transition',
                    active
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
                  ].join(' ')}
                  aria-pressed={active}
                  title={`Display as ${getReaderDisplayScriptLabel(script)}`}
                >
                  {getReaderDisplayScriptLabel(script)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-w-[18rem] flex-1 items-center gap-2 rounded-md border border-stone-300/70 bg-white/55 px-2 py-1">
          <Search className="h-4 w-4 text-stone-500" />
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="sr-only">Search document</span>
            <input
              value={documentSearchQuery}
              onChange={(event) => setDocumentSearchQuery(event.target.value)}
              placeholder="Search document"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
          </label>
          <span className="whitespace-nowrap text-[0.72rem] uppercase tracking-[0.14em] text-stone-500">
            {activeDocumentSearchIndex}/{documentSearchHitCount}
          </span>
          <button
            type="button"
            onClick={() =>
              setDocumentSearchActiveIndex(
                documentSearchHitCount > 0
                  ? (documentSearchActiveIndex - 1 + documentSearchHitCount) % documentSearchHitCount
                  : 0,
              )
            }
            disabled={!hasDocumentSearchHits}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Previous document match"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setDocumentSearchActiveIndex(
                documentSearchHitCount > 0 ? (documentSearchActiveIndex + 1) % documentSearchHitCount : 0,
              )
            }
            disabled={!hasDocumentSearchHits}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Next document match"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-300/70 bg-white/55 px-2 py-1">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Fonts</span>
          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Sanskrit</span>
          <div className="flex flex-wrap gap-1">
            {sanskritFontOptions.map((option) => {
              const active = sanskritFontPreset === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSanskritFontPreset(option.value)}
                  className={[
                    'rounded-md border px-2 py-1 text-xs transition',
                    active
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <span className="text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Tamil</span>
          <div className="flex flex-wrap gap-1">
            {tamilFontOptions.map((option) => {
              const active = tamilFontPreset === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTamilFontPreset(option.value)}
                  className={[
                    'rounded-md border px-2 py-1 text-xs transition',
                    active
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
                  ].join(' ')}
                  aria-pressed={active}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTypography({ fontSize: Math.max(15, fontSize - 1) })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white"
            aria-label="Decrease font size"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTypography({ fontSize: Math.min(30, fontSize + 1) })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white"
            aria-label="Increase font size"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white"
          >
            <SunMoon className="h-4 w-4" />
            <span>{theme}</span>
          </button>
          <button
            type="button"
            onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
            className={[
              'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
              diagnosticsOpen
                ? 'border-stone-900 bg-stone-900 text-stone-50'
                : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
            ].join(' ')}
          >
            <SplitSquareHorizontal className="h-4 w-4" />
            <span>Diagnostics</span>
          </button>
          <button
            type="button"
            onClick={() => void loadManifest({ force: true })}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => void handleCopyText()}
            disabled={!activeDocument}
            className="inline-flex items-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2 text-sm text-stone-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={`Copy visible text as ${getReaderDisplayScriptLabel(displayScript)}`}
          >
            <Copy className="h-4 w-4" />
            <span>{copyLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
