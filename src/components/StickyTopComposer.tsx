// app/src/components/StickyTopComposer.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { Check, ChevronLeft, ChevronRight, Copy, Trash2, Undo2 } from 'lucide-react';
import { BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { ShortcutHUD } from '@/components/engine/ShortcutHUD';
import { detransliterate } from '@/lib/vedic/utils';
import { VEDIC_MAPPINGS } from '@/lib/vedic/mapping';
import { applyShortcutPeekCorrection } from '@/lib/vedic/correction';
import type { ChunkEditTarget } from '@/store/types';

export const StickyTopComposer: React.FC = () => {
  const { 
    getActiveBlock, getActiveChunkGroup, updateChunkSource, setNextChunk, setPrevChunk, setNextBlock, setPrevBlock, setFocusSpan, setViewMode, toggleReferencePanel, addBlocks, deleteBlock, restoreDeletedBlock, dismissDeletedBlock, setDeletedBuffer, setComposerSelection, setLexicalSelectedSuggestionIndex, recordSessionLexicalText, recordSessionLexicalUse, editorState,
    activeBuffer, // Get activeBuffer for Backspace logic
    lexicalSuggestions,
    lexicalSelectedSuggestionIndex,
    deletedBuffer,
    isReferencePanelOpen, // To check if panel is open
    composerSelectionStart,
    composerSelectionEnd,
    recentlyDeletedBlock,
    typography,
  } = useFlowStore();
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [isShortcutPeekVisible, setIsShortcutPeekVisible] = React.useState(false);
  const [deleteToastProgress, setDeleteToastProgress] = React.useState(1);
  const activeBlock = getActiveBlock();
  const activeChunkGroup = getActiveChunkGroup();
  const { focusSpan, viewMode } = editorState;

  const isLongBlock = activeBlock?.type === 'long';
  const currentChunkSource = activeChunkGroup?.source || ''; // Get current chunk source
  const currentEditTarget: ChunkEditTarget | undefined = activeChunkGroup?.blockId
    ? {
        blockId: activeChunkGroup.blockId,
        startSegmentIndex: activeChunkGroup.startSegmentIndex,
        endSegmentIndex: activeChunkGroup.endSegmentIndex,
        source: activeChunkGroup.source,
      }
    : undefined;
  const textareaKey = activeChunkGroup
    ? `${activeChunkGroup.blockId ?? 'none'}:${activeChunkGroup.startSegmentIndex}:${activeChunkGroup.endSegmentIndex}`
    : 'no-active-chunk';
  const totalChunkGroups =
    activeBlock && activeBlock.type === 'long' && activeBlock.segments
      ? Math.ceil(activeBlock.segments.length / { tight: 1, balanced: 2, wide: 3 }[focusSpan])
      : 1;
  const activeChunkNumber =
    activeBlock &&
    activeBlock.type === 'long' &&
    activeBlock.segments &&
    activeChunkGroup
      ? Math.floor(activeChunkGroup.startSegmentIndex / { tight: 1, balanced: 2, wide: 3 }[focusSpan]) + 1
      : 1;
  const resolvePeekMappings = (query: string) =>
    VEDIC_MAPPINGS
      .filter((mapping) =>
        mapping.itrans.toLowerCase().startsWith(query.toLowerCase()) ||
        (mapping.name || '').toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 6);

  let shortcutPeekState: { query: string; mappings: typeof VEDIC_MAPPINGS } = {
    query: deletedBuffer || activeBuffer,
    mappings: [],
  };

  if (deletedBuffer) {
    const deletedMatches = resolvePeekMappings(deletedBuffer);
    if (deletedMatches.length > 0) {
      shortcutPeekState = { query: deletedBuffer, mappings: deletedMatches };
    }
  }

  if (shortcutPeekState.mappings.length === 0) {
    for (let index = 0; index < activeBuffer.length; index++) {
      const suffix = activeBuffer.slice(index);
      const suffixMatches = resolvePeekMappings(suffix);
      if (suffixMatches.length > 0) {
        shortcutPeekState = { query: suffix, mappings: suffixMatches };
        break;
      }
    }
  }

  const shortcutPeekQuery = shortcutPeekState.query;
  const shortcutPeekMappings = shortcutPeekState.mappings;
  const hasLexicalSuggestions = lexicalSuggestions.length > 0 && activeBuffer.length > 1;

  const acceptLexicalSuggestion = (index: number) => {
    const suggestion = lexicalSuggestions[index];
    if (!suggestion) {
      return false;
    }

    const replacementLength = activeBuffer.length;
    const replaceEnd = composerSelectionEnd ?? currentChunkSource.length;
    const replaceStart = Math.max(0, replaceEnd - replacementLength);
    const newSource =
      currentChunkSource.slice(0, replaceStart) +
      suggestion.itrans +
      currentChunkSource.slice(replaceEnd);
    const nextCaret = replaceStart + suggestion.itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
    setLexicalSelectedSuggestionIndex(0);
    recordSessionLexicalUse(suggestion.itrans);
    setDeletedBuffer(null);
    setIsShortcutPeekVisible(false);
    return true;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    const isDevanagari = /[\u0900-\u097F]/.test(pastedText);
    const isMultiLine = pastedText.includes('\n') || pastedText.includes('\r');

    if (isDevanagari) {
      e.preventDefault();
      const itransText = detransliterate(pastedText);

      if (isMultiLine) {
        const itransLines = itransText.split(/\r?\n/).filter(line => line.trim().length > 0);
        addBlocks(itransLines);
        return;
      }

      const target = e.currentTarget;
      const selectionStart = target.selectionStart;
      const selectionEnd = target.selectionEnd;
      const currentSource = activeChunkGroup?.source || '';
      const newSource =
        currentSource.slice(0, selectionStart) +
        itransText +
        currentSource.slice(selectionEnd);
      const nextCaret = selectionStart + itransText.length;

      updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
      recordSessionLexicalText(itransText);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setComposerSelection(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);

    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Tab' && hasLexicalSuggestions) {
      e.preventDefault();
      const direction = e.shiftKey ? -1 : 1;
      const nextIndex =
        (lexicalSelectedSuggestionIndex + direction + lexicalSuggestions.length) % lexicalSuggestions.length;
      setLexicalSelectedSuggestionIndex(nextIndex);
      return;
    }

    if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Enter' && hasLexicalSuggestions) {
      if (acceptLexicalSuggestion(lexicalSelectedSuggestionIndex)) {
        e.preventDefault();
        return;
      }
    }

    if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      setNextChunk();
      return;
    }

    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      setPrevChunk();
      return;
    }

    if (e.altKey && e.key === 'PageDown') {
      e.preventDefault();
      setNextBlock();
      return;
    }

    if (e.altKey && e.key === 'PageUp') {
      e.preventDefault();
      setPrevBlock();
      return;
    }

    if (e.key === 'Escape') {
      if (isShortcutPeekVisible) {
        e.preventDefault();
        setIsShortcutPeekVisible(false);
        setDeletedBuffer(null);
        return;
      }

      if (isReferencePanelOpen) {
        e.preventDefault();
        toggleReferencePanel();
        return;
      }
    }

    if (e.key === 'Backspace') {
      let charToDelete: string | null = null;
      if (activeBuffer.length > 0) {
        // If there's an active buffer, deleted char is its last char
        charToDelete = activeBuffer.slice(-1);
      } else if (currentChunkSource.length > 0) {
        // If no active buffer, deleted char is from main source before cursor
        // (Assuming cursor is at the end of currentChunkSource for simplicity here)
        charToDelete = currentChunkSource.slice(-1);
      }

      if (charToDelete) {
        setDeletedBuffer(charToDelete);
        setIsShortcutPeekVisible(true);
      }
    } else {
      setDeletedBuffer(null);
      setIsShortcutPeekVisible(false);
    }
  };

  const syncSelection = (target: HTMLTextAreaElement) => {
    setComposerSelection(target.selectionStart, target.selectionEnd);
  };

  React.useLayoutEffect(() => {
    if (composerRef.current && document.activeElement === composerRef.current) {
      composerRef.current.setSelectionRange(composerSelectionStart, composerSelectionEnd);
    }
  }, [currentChunkSource, composerSelectionStart, composerSelectionEnd]);

  React.useEffect(() => {
    if (copyState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

  React.useEffect(() => {
    if (!recentlyDeletedBlock) {
      setDeleteToastProgress(1);
      return;
    }

    const durationMs = 20000;
    const startedAt = window.performance.now();
    setDeleteToastProgress(1);

    const intervalId = window.setInterval(() => {
      const elapsedMs = window.performance.now() - startedAt;
      const nextProgress = Math.max(0, 1 - elapsedMs / durationMs);
      setDeleteToastProgress(nextProgress);
      if (nextProgress <= 0) {
        window.clearInterval(intervalId);
        dismissDeletedBlock();
      }
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [dismissDeletedBlock, recentlyDeletedBlock]);

  const handleCopyRendered = async () => {
    const textToCopy = viewMode === 'focus'
      ? activeChunkGroup?.rendered || ''
      : activeBlock?.rendered || '';

    if (!textToCopy) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  const handleDeleteBlock = () => {
    if (!activeBlock) {
      return;
    }

    deleteBlock(activeBlock.id);
    setDeletedBuffer(null);
    setIsShortcutPeekVisible(false);
  };

  const handlePeekInsert = (itrans: string) => {
    const { nextSource, nextCaret } = applyShortcutPeekCorrection({
      currentSource: currentChunkSource,
      selectionStart: composerSelectionStart,
      selectionEnd: composerSelectionEnd,
      replacement: itrans,
      deletedBuffer,
      shortcutPeekQuery,
    });
    updateChunkSource(nextSource, nextCaret, nextCaret, currentEditTarget);
    setIsShortcutPeekVisible(false);
    setDeletedBuffer(null);
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return (
    <div className="sticky top-0 z-50 bg-white shadow-lg p-4 border-b border-slate-200">
      <div className="max-w-5xl mx-auto flex flex-col gap-2">
        {/* Top bar: Block Info, Focus Span, and View Modes */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              {activeBlock?.title || `Block ${activeBlock?.id}`}:{' '}
              {isLongBlock && activeChunkGroup ? `Chunk ${activeChunkNumber} of ${totalChunkGroups}` : 'Full Block'}
            </span>
            {isLongBlock && (
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold">Focus Span:</span>
                <select
                  value={focusSpan}
                  onChange={(e) => setFocusSpan(e.target.value as 'tight' | 'balanced' | 'wide')}
                  className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1"
                >
                  <option value="tight">Tight</option>
                  <option value="balanced">Balanced</option>
                  <option value="wide">Wide</option>
                </select>
              </div>
            )}
          </div>
          
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('read')}
              className={clsx(
                "px-3 py-1 rounded-md text-xs font-bold uppercase",
                viewMode === 'read' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Read
            </button>
            <button
              onClick={() => setViewMode('review')}
              className={clsx(
                "px-3 py-1 rounded-md text-xs font-bold uppercase",
                viewMode === 'review' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Review
            </button>
          </div>
        </div>

        {/* Action buttons (e.g., Reference, etc.) */}
        <div className="flex items-center justify-end">
          <button
            onClick={toggleReferencePanel}
            className="px-3 py-1 bg-slate-100 rounded-md hover:bg-slate-200 text-xs font-bold uppercase text-slate-700 flex items-center gap-1"
            type="button"
          >
            <BookOpen className="w-4 h-4" /> Reference
          </button>
        </div>

        {/* Source Input Area */}
        <textarea
          key={textareaKey}
          ref={composerRef}
          autoFocus
          className="w-full text-lg font-mono p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            fontSize: `${typography.itransFontSize}px`,
            lineHeight: typography.itransLineHeight,
          }}
          value={activeChunkGroup?.source || ''}
          onChange={(e) => updateChunkSource(e.target.value, e.target.selectionStart, e.target.selectionEnd, currentEditTarget)}
          onPaste={handlePaste} // Add onPaste listener
          onKeyDown={handleKeyDown} // Add onKeyDown listener
          onSelect={(e) => syncSelection(e.currentTarget)}
          onClick={(e) => syncSelection(e.currentTarget)}
          onKeyUp={(e) => syncSelection(e.currentTarget)}
          onFocus={(e) => syncSelection(e.currentTarget)}
          rows={Math.min(6, Math.max(1, currentChunkSource.split('\n').length))}
          placeholder="Type ITRANS here..."
        />

        {/* Immediate Live Devanagari Confirmation */}
        <div className="min-h-[2.5rem] flex items-start justify-between gap-3 bg-blue-50 p-2 rounded-md text-blue-800">
          <div
            className="flex-1 font-serif"
            style={{
              fontSize: `${typography.renderedFontSize}px`,
              lineHeight: typography.renderedLineHeight,
            }}
          >
            {activeChunkGroup?.rendered || 'Devanagari preview'}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={handleDeleteBlock}
              className="rounded-md border border-rose-200 bg-white p-2 text-rose-700 hover:bg-rose-100"
              type="button"
              aria-label="Delete active block"
              title="Delete block"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyRendered}
              className={clsx(
                'rounded-md border p-2',
                copyState === 'copied'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : copyState === 'error'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-white text-slate-700 border-blue-200 hover:bg-blue-100'
              )}
              type="button"
              aria-label="Copy rendered Sanskrit"
              title={copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy Sanskrit'}
            >
              {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {recentlyDeletedBlock && (
          <div
            data-testid="recently-deleted-block"
            className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Block Deleted</p>
              <p className="mt-1 text-xs">
                {recentlyDeletedBlock.block.title || 'Untitled Block'} was removed from the document.
              </p>
            </div>
            <button
              type="button"
              onClick={restoreDeletedBlock}
              className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-2 text-xs font-bold uppercase text-amber-800 hover:bg-amber-100"
              aria-label="Undo delete"
            >
              <span
                aria-hidden="true"
                className="inline-block h-4 w-4 rounded-full border border-amber-300"
                style={{
                  background: `conic-gradient(rgb(217 119 6) ${deleteToastProgress * 360}deg, rgb(253 230 138) 0deg)`,
                }}
              />
              <Undo2 className="h-4 w-4" />
              Undo
            </button>
          </div>
        )}

        {isShortcutPeekVisible && shortcutPeekMappings.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">Correction Help</p>
                <p className="mt-1 text-xs text-amber-800">
                  Backspace opened a compact shortcut peek for <span className="font-mono font-semibold">{shortcutPeekQuery}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsShortcutPeekVisible(false)}
                className="text-xs font-bold uppercase text-amber-700 hover:text-amber-900"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {shortcutPeekMappings.map((mapping) => (
                <button
                  key={`${mapping.itrans}-${mapping.unicode}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handlePeekInsert(mapping.itrans)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-left hover:border-amber-300 hover:bg-amber-100"
                >
                  <span className="text-lg font-serif text-slate-900">{mapping.unicode}</span>
                  <kbd className="text-[10px] font-mono font-bold text-amber-700">{mapping.itrans}</kbd>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Shortcut HUD */}
        <ShortcutHUD />

        {/* Chunk Navigation Controls */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          {isLongBlock && (
            <div className="flex gap-2">
              <button onClick={setPrevChunk} className="px-3 py-1 bg-slate-100 rounded-md hover:bg-slate-200 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Prev Chunk
              </button>
              <button onClick={setNextChunk} className="px-3 py-1 bg-slate-100 rounded-md hover:bg-slate-200 flex items-center gap-1">
                Next Chunk <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <span className="text-xs text-slate-400">
            {isLongBlock ? 'Alt+Up/Down: chunks • Alt+PgUp/PgDn: blocks • Esc: close reference' : ''}
          </span>
        </div>
      </div>
    </div>
  );
};
