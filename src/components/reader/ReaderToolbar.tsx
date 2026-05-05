'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  BookOpenText,
  Copy,
  FileText,
  Languages,
  Menu,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SplitSquareHorizontal,
  SunMoon,
  X,
} from 'lucide-react';
import { useReaderStore } from '@/store/useReaderStore';
import type { ReaderDisplayScript, ReaderMode, ReaderPageSize } from '@/lib/veda-book/types';
import { getReaderDisplayScriptLabel, getReaderPageSizeLabel, serializeReaderDocumentText } from '@/lib/veda-book/renderText';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';
import { readerThemeTextClass } from './readerTheme';

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
  compact?: boolean;
  hidden?: boolean;
}

export function ReaderToolbar({ documentSearchHitCount = 0, compact = false, hidden = false }: ReaderToolbarProps) {
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
  const theme = useReaderStore((state) => state.theme);
  const sidebarOpen = useReaderStore((state) => state.sidebarOpen);

  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [overflowOpen, setOverflowOpen] = useState(false);

  const currentThemeIndex = themeOrder.indexOf(theme);
  const nextTheme = themeOrder[(currentThemeIndex + 1) % themeOrder.length];
  const copyLabel = copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : 'Copy text';
  const hasDocumentSearchHits = documentSearchHitCount > 0;
  const bodyTextClass = readerThemeTextClass(theme, 'text-stone-700');
  const mutedTextClass = readerThemeTextClass(theme, 'text-stone-500', 'text-white/70');
  const titleTextClass = readerThemeTextClass(theme, 'text-stone-900');
  const softTextClass = readerThemeTextClass(theme, 'text-stone-400', 'text-white/60');

  useEffect(() => {
    if (copyStatus !== 'copied') {
      return undefined;
    }

    const timeout = window.setTimeout(() => setCopyStatus('idle'), 1200);
    return () => window.clearTimeout(timeout);
  }, [copyStatus]);

  useEffect(() => {
    if (!overflowOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const panel = document.querySelector<HTMLElement>('[data-reader-overflow-panel="true"]');
      if (!panel || panel.contains(event.target as Node)) {
        return;
      }

      setOverflowOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOverflowOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowOpen]);

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

  const toolbarTitle = compact ? 'Veda Reader' : 'GitHub Pages source reader';

  return (
    <header
      className={[
        'sticky top-0 z-40 border-b border-stone-300/70 bg-inherit/90 backdrop-blur transition-transform duration-200 ease-out',
        hidden ? '-translate-y-full md:-translate-y-full' : 'translate-y-0',
      ].join(' ')}
    >
      <div className={`flex items-center gap-2 px-3 ${compact ? 'py-2' : 'flex-wrap py-3'}`}>
        <div className="flex min-w-0 items-center gap-2 pr-2">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/60 shadow-sm transition hover:bg-white ${bodyTextClass}`}
            aria-label="Toggle sidebar"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <div className={`text-[0.7rem] uppercase tracking-[0.22em] ${mutedTextClass}`}>Veda Reader</div>
            <div className={`truncate text-sm font-medium ${titleTextClass}`}>{toolbarTitle}</div>
          </div>
        </div>

        <div className={`flex items-center gap-1 ${compact ? 'overflow-x-auto' : 'flex-wrap'}`}>
          {modeOptions.map((option) => {
            const active = readerMode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setReaderMode(option.mode)}
                className={[
                  compact
                    ? 'inline-flex h-10 w-10 items-center justify-center rounded-md border text-xs transition'
                    : 'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                  active
                    ? 'border-stone-900 bg-stone-900 text-stone-50'
                    : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                ].join(' ')}
                aria-label={option.label}
                title={option.label}
              >
                {option.icon}
                {!compact ? <span>{option.label}</span> : null}
              </button>
            );
          })}
        </div>

        <div className={`ml-auto flex items-center gap-1 ${compact ? 'flex-nowrap' : 'flex-wrap'}`}>
          <button
            type="button"
            onClick={() => setDocumentSearchOpen(true)}
            className={`relative inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`}
            aria-label="Open document search"
            title="Open document search"
          >
            <Search className={['h-4 w-4', documentSearchOpen ? 'text-white' : bodyTextClass].join(' ')} />
            {hasDocumentSearchHits ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-5 text-white">
                {documentSearchHitCount > 9 ? '9+' : documentSearchHitCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setTheme(nextTheme)}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`}
            aria-label={`Switch to ${nextTheme} theme`}
            title={`Switch to ${nextTheme} theme`}
          >
            <SunMoon className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setOverflowOpen((current) => !current)}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-stone-300/70 bg-white/70 transition hover:bg-white ${bodyTextClass}`}
              aria-label="Open reader options"
              aria-expanded={overflowOpen}
            >
              <Settings2 className="h-4 w-4" />
            </button>
            {overflowOpen ? (
              <div
                data-reader-overflow-panel="true"
                className={`absolute right-0 top-full z-50 mt-2 w-[min(23rem,calc(100vw-1.5rem))] rounded-2xl border border-stone-300/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl ${bodyTextClass}`}
              >
                <div className="grid gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className={`text-[0.65rem] uppercase tracking-[0.2em] ${mutedTextClass}`}>Reader options</div>
                      <div className={`text-sm font-semibold ${titleTextClass}`}>Typography and display</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOverflowOpen(false)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 hover:bg-white"
                      aria-label="Close reader options"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-2">
                    <div className={`text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Display</div>
                    <div className="flex flex-wrap gap-2">
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
                                : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                            ].join(' ')}
                          >
                            {getReaderDisplayScriptLabel(script)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <div className={`text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Fonts</div>
                    <div className="grid gap-2">
                      <div className={`text-[0.68rem] uppercase tracking-[0.16em] ${softTextClass}`}>Sanskrit</div>
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
                                  : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                              ].join(' ')}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className={`text-[0.68rem] uppercase tracking-[0.16em] ${softTextClass}`}>Tamil</div>
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
                                  : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                              ].join(' ')}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-stone-300/70 bg-white/70 p-2">
                      <div className={`mb-2 text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Page</div>
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
                                  : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                              ].join(' ')}
                              aria-pressed={active}
                            >
                              {getReaderPageSizeLabel(value)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-stone-300/70 bg-white/70 p-2">
                      <div className={`mb-2 text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Font size</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTypography({ fontSize: Math.max(15, fontSize - 1) })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 ${bodyTextClass} hover:bg-white`}
                          aria-label="Decrease font size"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <div className={`min-w-12 text-center text-xs font-medium ${bodyTextClass}`}>{fontSize}px</div>
                        <button
                          type="button"
                          onClick={() => setTypography({ fontSize: Math.min(30, fontSize + 1) })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 ${bodyTextClass} hover:bg-white`}
                          aria-label="Increase font size"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className={`mt-3 mb-2 text-xs uppercase tracking-[0.18em] ${mutedTextClass}`}>Leading</div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setTypography({ lineHeight: Math.max(1.2, Number((lineHeight - 0.1).toFixed(2))) })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 ${bodyTextClass} hover:bg-white`}
                          aria-label="Decrease line height"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <div className={`min-w-12 text-center text-xs font-medium ${bodyTextClass}`}>{lineHeight.toFixed(2)}</div>
                        <button
                          type="button"
                          onClick={() => setTypography({ lineHeight: Math.min(2.4, Number((lineHeight + 0.1).toFixed(2))) })}
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-stone-300/70 bg-white/80 ${bodyTextClass} hover:bg-white`}
                          aria-label="Increase line height"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDiagnosticsOpen(!diagnosticsOpen)}
                      className={[
                        'inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                        diagnosticsOpen
                          ? 'border-stone-900 bg-stone-900 text-stone-50'
                          : `border-stone-300/70 bg-white/70 ${bodyTextClass} hover:bg-white`,
                      ].join(' ')}
                    >
                      <SplitSquareHorizontal className="h-4 w-4" />
                      Diagnostics
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadManifest({ force: true })}
                      className={`inline-flex items-center justify-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2 text-sm ${bodyTextClass} hover:bg-white`}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleCopyText()}
                    disabled={!activeDocument}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border border-stone-300/70 bg-white/70 px-3 py-2 text-sm ${bodyTextClass} hover:bg-white disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-label={`Copy visible text as ${getReaderDisplayScriptLabel(displayScript)}`}
                  >
                    <Copy className="h-4 w-4" />
                    <span>{copyLabel}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
