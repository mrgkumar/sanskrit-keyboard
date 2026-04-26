'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BookOpenText,
  Copy,
  FileText,
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
import type { ReaderDisplayScript, ReaderMode, ReaderPageSize } from '@/lib/veda-book/types';
import {
  getReaderDisplayScriptLabel,
  getReaderPageSizeLabel,
  serializeReaderDocumentText,
} from '@/lib/veda-book/renderText';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

const modeOptions: Array<{ mode: ReaderMode; label: string; icon: ReactNode }> = [
  { mode: 'reader', label: 'Reader', icon: <BookOpenText className="h-4 w-4" /> },
  { mode: 'compare', label: 'Compare', icon: <Languages className="h-4 w-4" /> },
  { mode: 'source', label: 'Source', icon: <FileText className="h-4 w-4" /> },
  { mode: 'split', label: 'Split', icon: <SplitSquareHorizontal className="h-4 w-4" /> },
];

const displayScriptOptions: ReaderDisplayScript[] = ['original', 'devanagari', 'roman', 'tamil'];
const themeOrder = ['sepia', 'light', 'dark'] as const;
const pageSizeOptions: ReaderPageSize[] = ['a4', 'web'];
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
  const documentSearchOpen = useReaderStore((state) => state.documentSearchOpen);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineHeight = useReaderStore((state) => state.lineHeight);
  const loadManifest = useReaderStore((state) => state.loadManifest);
  const pageSize = useReaderStore((state) => state.pageSize);
  const readerMode = useReaderStore((state) => state.readerMode);
  const sanskritFontPreset = useReaderStore((state) => state.sanskritFontPreset);
  const tamilFontPreset = useReaderStore((state) => state.tamilFontPreset);
  const setSanskritFontPreset = useReaderStore((state) => state.setSanskritFontPreset);
  const setTamilFontPreset = useReaderStore((state) => state.setTamilFontPreset);
  const setDisplayScript = useReaderStore((state) => state.setDisplayScript);
  const setDiagnosticsOpen = useReaderStore((state) => state.setDiagnosticsOpen);
  const setReaderMode = useReaderStore((state) => state.setReaderMode);
  const setPageSize = useReaderStore((state) => state.setPageSize);
  const setDocumentSearchOpen = useReaderStore((state) => state.setDocumentSearchOpen);
  const setSidebarOpen = useReaderStore((state) => state.setSidebarOpen);
  const setTheme = useReaderStore((state) => state.setTheme);
  const setTypography = useReaderStore((state) => state.setTypography);
  const sidebarOpen = useReaderStore((state) => state.sidebarOpen);
  const theme = useReaderStore((state) => state.theme);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const currentThemeIndex = themeOrder.indexOf(theme);
  const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];
  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy text';
  const hasDocumentSearchHits = documentSearchHitCount > 0;
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

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-stone-300/70 bg-white/55 px-2 py-1">
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Page</span>
          <div className="flex flex-wrap gap-1">
            {pageSizeOptions.map((value) => {
              const active = pageSize === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPageSize(value)}
                  className={[
                    'rounded-md border px-2 py-1 text-xs transition',
                    active
                      ? 'border-stone-900 bg-stone-900 text-stone-50'
                      : 'border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white',
                  ].join(' ')}
                  aria-pressed={active}
                  title={`Set page size to ${getReaderPageSizeLabel(value)}`}
                >
                  {getReaderPageSizeLabel(value)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDocumentSearchOpen(true)}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 text-stone-700 hover:bg-white"
            aria-label="Open document search"
            title="Open document search"
          >
            <Search className={['h-4 w-4', documentSearchOpen ? 'text-stone-950' : 'text-stone-700'].join(' ')} />
            {hasDocumentSearchHits ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-5 text-white">
                {documentSearchHitCount > 9 ? '9+' : documentSearchHitCount}
              </span>
            ) : null}
          </button>
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
          <div className="flex items-center gap-1 rounded-md border border-stone-300/70 bg-white/70 px-2 py-1">
            <span className="text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">Leading</span>
            <button
              type="button"
              onClick={() => setTypography({ lineHeight: Math.max(1.2, Number((lineHeight - 0.1).toFixed(2))) })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 text-stone-700 hover:bg-white"
              aria-label="Decrease line height"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <div className="min-w-12 text-center text-xs font-medium text-stone-700">{lineHeight.toFixed(2)}</div>
            <button
              type="button"
              onClick={() => setTypography({ lineHeight: Math.min(2.4, Number((lineHeight + 0.1).toFixed(2))) })}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 text-stone-700 hover:bg-white"
              aria-label="Increase line height"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
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
