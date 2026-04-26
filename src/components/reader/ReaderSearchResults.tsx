'use client';

import type React from 'react';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { clsx } from 'clsx';
import { ScriptText } from '@/components/ScriptText';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';
import { canonicalizeReaderSearchPaste } from '@/lib/vedic/utils';
import {
  detectReaderSourceScript,
  formatReaderDisplayText,
  getReaderDisplayScriptLabel,
  type ReaderDisplayScript,
} from '@/lib/veda-book/renderText';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

interface ReaderSearchResultsProps {
  open: boolean;
  query: string;
  hitCount: number;
  activeIndex: number;
  displayScript: ReaderDisplayScript;
  sanskritFontPreset: SanskritFontPreset;
  tamilFontPreset: TamilFontPreset;
  onChangeQuery: (query: string) => void;
  onPreviousHit: () => void;
  onNextHit: () => void;
  onClose: () => void;
}

interface PanelPosition {
  x: number;
  y: number;
}

const DEFAULT_PANEL_POSITION: PanelPosition = {
  x: 280,
  y: 112,
};

export function ReaderSearchResults({
  open,
  query,
  hitCount,
  activeIndex,
  displayScript,
  sanskritFontPreset,
  tamilFontPreset,
  onChangeQuery,
  onPreviousHit,
  onNextHit,
  onClose,
}: ReaderSearchResultsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const [position, setPosition] = useState<PanelPosition>(DEFAULT_PANEL_POSITION);
  const [isDragging, setIsDragging] = useState(false);
  const [draftQuery, setDraftQuery] = useState(query);
  const deferredDraftQuery = useDeferredValue(draftQuery);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraftQuery(query);
  }, [open, query]);

  useEffect(() => {
    if (commitTimerRef.current !== null) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }

    if (!open) {
      return undefined;
    }

    commitTimerRef.current = window.setTimeout(() => {
      commitTimerRef.current = null;
      if (draftQuery !== query) {
        onChangeQuery(draftQuery);
      }
    }, 240);

    return () => {
      if (commitTimerRef.current !== null) {
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = null;
      }
    };
  }, [draftQuery, onChangeQuery, open, query]);

  const trimmedQuery = deferredDraftQuery.trim();
  const previewText = useMemo(() => {
    if (!trimmedQuery) {
      return '';
    }

    return formatReaderDisplayText(
      trimmedQuery,
      displayScript,
      detectReaderSourceScript(trimmedQuery),
      DEFAULT_OUTPUT_TARGET_SETTINGS,
      { sanskritFontPreset },
    );
  }, [displayScript, sanskritFontPreset, trimmedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!isDragging) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const offset = dragOffsetRef.current;
      const panel = panelRef.current;
      if (!offset || !panel) {
        return;
      }

      const nextX = Math.max(12, Math.min(window.innerWidth - panel.offsetWidth - 12, event.clientX - offset.x));
      const nextY = Math.max(12, Math.min(window.innerHeight - panel.offsetHeight - 12, event.clientY - offset.y));
      setPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      dragOffsetRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (open) {
      return;
    }

    setIsDragging(false);
    dragOffsetRef.current = null;
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    if (event.shiftKey) {
      onPreviousHit();
      return;
    }

    onNextHit();
  };

  const commitDraftQuery = () => {
    if (draftQuery !== query) {
      onChangeQuery(draftQuery);
    }
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = event.clipboardData.getData('text');
    const canonicalText = canonicalizeReaderSearchPaste(pastedText);

    if (canonicalText === pastedText) {
      return;
    }

    event.preventDefault();
    const target = event.currentTarget;
    const selectionStart = target.selectionStart ?? draftQuery.length;
    const selectionEnd = target.selectionEnd ?? draftQuery.length;
    const nextQuery = `${draftQuery.slice(0, selectionStart)}${canonicalText}${draftQuery.slice(selectionEnd)}`;
    setDraftQuery(nextQuery);

    window.requestAnimationFrame(() => {
      const nextCaret = selectionStart + canonicalText.length;
      target.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const startDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement | null)?.closest('button')) {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    event.preventDefault();
    dragOffsetRef.current = {
      x: event.clientX - panel.getBoundingClientRect().left,
      y: event.clientY - panel.getBoundingClientRect().top,
    };
    setIsDragging(true);
  };

  if (!open) {
    return null;
  }

  const handleClose = () => {
    commitDraftQuery();
    onClose();
  };

  return (
    <section
      ref={panelRef}
      className={clsx(
        'fixed z-50 flex resize flex-col overflow-auto rounded-2xl border border-white/50 bg-white/70 shadow-2xl backdrop-blur-2xl',
        isDragging && 'select-none',
      )}
      style={{ left: position.x, top: position.y, width: 'min(42rem, calc(100vw - 24px))', height: 'min(32rem, calc(100vh - 24px))' }}
      data-testid="reader-search-panel"
      aria-label="Document search panel"
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-stone-200/80 px-4 py-3"
        onPointerDown={startDragging}
      >
        <div className="flex items-center gap-2">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-white">
            <Search className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.22em] text-stone-500">Search</div>
            <div className="text-sm font-semibold text-stone-900">Search current document</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousHit}
            disabled={hitCount === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300/70 bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous match"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextHit}
            disabled={hitCount === 0}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300/70 bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next match"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="min-w-[4.25rem] text-right text-[0.65rem] uppercase tracking-[0.22em] text-stone-500">
            {hitCount > 0 ? `${activeIndex + 1}/${hitCount}` : '0/0'}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300/70 bg-white/80 text-stone-500 hover:bg-white hover:text-stone-800"
            aria-label="Close search panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4">
        <div className="rounded-2xl border border-stone-200/80 bg-white/80 px-4 py-3 shadow-sm">
          <label className="block">
            <span className="sr-only">Search document</span>
            <input
              ref={inputRef}
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              placeholder="Type Roman / ITRANS here"
              autoComplete="off"
              spellCheck={false}
              className="w-full bg-transparent text-sm font-medium text-stone-900 outline-none placeholder:text-stone-400"
              data-testid="reader-search-input"
            />
          </label>
          <div className="mt-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-700">
            <div className="flex items-center justify-between gap-2 text-[0.65rem] uppercase tracking-[0.22em] text-stone-400">
              <span>Ghost preview</span>
              <span>{getReaderDisplayScriptLabel(displayScript)}</span>
            </div>
            <div className="mt-1 min-h-6">
              {previewText ? (
                <span className="pointer-events-none select-none opacity-80">
                  {displayScript === 'original' ? (
                    <span className="font-medium text-stone-800">{previewText}</span>
                  ) : (
                    <ScriptText
                      script={displayScript}
                      text={previewText}
                      sanskritFontPreset={sanskritFontPreset}
                      tamilFontPreset={tamilFontPreset}
                      className="font-medium text-stone-800"
                    />
                  )}
                </span>
              ) : (
                <span className="text-stone-400">Type Roman / ITRANS to see a live preview.</span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200/80 bg-white/55 px-4 py-3 text-sm text-stone-600">
          {hitCount > 0 ? (
            <p className="leading-6">
              {`Use Prev / Next or Enter / Shift+Enter to move through ${hitCount} match${hitCount === 1 ? '' : 'es'}.`}
            </p>
          ) : (
            <p className="leading-6">Start typing to search the current document.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-stone-200/80 px-4 py-2 text-xs uppercase tracking-[0.16em] text-stone-500">
        <span>{displayScript === 'original' ? 'Original text' : getReaderDisplayScriptLabel(displayScript)} preview</span>
        <span>Esc closes</span>
      </div>
    </section>
  );
}
