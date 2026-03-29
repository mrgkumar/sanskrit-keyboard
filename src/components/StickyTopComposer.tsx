// app/src/components/StickyTopComposer.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { ShortcutHUD } from '@/components/engine/ShortcutHUD';
import { detransliterate } from '@/lib/vedic/utils';

export const StickyTopComposer: React.FC = () => {
  const { 
    getActiveBlock, getActiveChunkGroup, updateChunkSource, setNextChunk, setPrevChunk, setFocusSpan, setViewMode, toggleReferencePanel, addBlocks, setDeletedBuffer, setComposerSelection, editorState,
    activeBuffer, // Get activeBuffer for Backspace logic
    isReferencePanelOpen, // To check if panel is open
    composerSelectionStart,
    composerSelectionEnd,
    typography,
  } = useFlowStore();
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const activeBlock = getActiveBlock();
  const activeChunkGroup = getActiveChunkGroup();
  const { focusSpan, viewMode } = editorState;

  const isLongBlock = activeBlock?.type === 'long';
  const currentChunkSource = activeChunkGroup?.source || ''; // Get current chunk source

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

      updateChunkSource(newSource, nextCaret, nextCaret);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    setComposerSelection(e.currentTarget.selectionStart, e.currentTarget.selectionEnd);

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
        if (!isReferencePanelOpen) { // Only open if not already open (manual open should keep it open)
          const { selectionStart, selectionEnd } = e.currentTarget;
          toggleReferencePanel();
          requestAnimationFrame(() => {
            if (composerRef.current) {
              composerRef.current.focus();
              composerRef.current.setSelectionRange(selectionStart, selectionEnd);
            }
          });
        }
      }
    } else {
      // Any other key clears deletedBuffer and potentially closes panel
      setDeletedBuffer(null);
      // Optional: if panel was opened by backspace and no longer needed, close it.
      // This might require a more sophisticated tracking of how panel was opened.
      // For now, let's keep it open or let user close it manually for other keys.
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

  return (
    <div className="sticky top-0 z-50 bg-white shadow-lg p-4 border-b border-slate-200">
      <div className="max-w-5xl mx-auto flex flex-col gap-2">
        {/* Top bar: Block Info, Focus Span, and View Modes */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-4">
            <span>
              {activeBlock?.title || `Block ${activeBlock?.id}`}:{' '}
              {isLongBlock && activeChunkGroup ? `Chunk ${activeChunkGroup.startSegmentIndex + 1}-${activeChunkGroup.endSegmentIndex + 1}` : 'Full Block'}
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
              onClick={() => setViewMode('focus')}
              className={clsx(
                "px-3 py-1 rounded-md text-xs font-bold uppercase",
                viewMode === 'focus' ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              Focus
            </button>
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
          ref={composerRef}
          className="w-full text-lg font-mono p-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            fontSize: `${typography.itransFontSize}px`,
            lineHeight: typography.itransLineHeight,
          }}
          value={activeChunkGroup?.source || ''}
          onChange={(e) => updateChunkSource(e.target.value, e.target.selectionStart, e.target.selectionEnd)}
          onPaste={handlePaste} // Add onPaste listener
          onKeyDown={handleKeyDown} // Add onKeyDown listener
          onSelect={(e) => syncSelection(e.currentTarget)}
          onClick={(e) => syncSelection(e.currentTarget)}
          onKeyUp={(e) => syncSelection(e.currentTarget)}
          onFocus={(e) => syncSelection(e.currentTarget)}
          rows={1}
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
          <button
            onClick={handleCopyRendered}
            className={clsx(
              'mt-1 rounded-md border p-2',
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
          <span></span> {/* Removed Contextual Help (TODO) */}
        </div>
      </div>
    </div>
  );
};
