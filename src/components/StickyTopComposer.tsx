// app/src/components/StickyTopComposer.tsx
'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useFlowStore } from '@/store/useFlowStore';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ShortcutHUD } from '@/components/engine/ShortcutHUD';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';
import { getScriptDisplayText, ScriptText } from '@/components/ScriptText';
import { VerticalResizeHandle } from '@/components/VerticalResizeHandle';
import {
  canonicalizeDevanagariPaste,
  formatSourceForScript,
  transliterate,
} from '@/lib/vedic/utils';
import {
  DISPLAY_MAPPINGS,
  getAcceptedInputs,
  getOutputTargetQuickLabels,
  OUTPUT_TARGET_CONTROL_LABELS,
  OUTPUT_TARGET_VALUE_LABELS,
} from '@/lib/vedic/mapping';
import { applyShortcutPeekCorrection } from '@/lib/vedic/correction';
import type { ChunkEditTarget } from '@/store/types';

export const StickyTopComposer: React.FC = () => {
  const { 
    blocks,
    getActiveBlock, getActiveChunkGroup, updateChunkSource, setNextChunk, setPrevChunk, setNextBlock, setPrevBlock, setFocusSpan, toggleReferencePanel, addBlocks, deleteBlock, mergeBlocks, splitBlock, restoreDeletedBlock, dismissDeletedBlock, setDeletedBuffer, setComposerSelection, setLexicalSelectedSuggestionIndex, recordSessionLexicalText, recordSessionLexicalUse, setPrimaryOutputScript, setComparisonOutputScript, editorState,
    activeBuffer, // Get activeBuffer for Backspace logic
    lexicalSuggestions,
    lexicalSelectedSuggestionIndex,
    deletedBuffer,
    isReferencePanelOpen, // To check if panel is open
    composerSelectionStart,
    composerSelectionEnd,
    recentlyDeletedBlock,
    displaySettings,
    setTypography,
    setAutoSwapVisargaSvarita,
  } = useFlowStore();
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const composerHighlightRef = React.useRef<HTMLDivElement>(null);
  const sourcePaneRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const itransPanelRef = React.useRef<HTMLDivElement>(null);
  const isPointerSelectingRef = React.useRef(false);
  const scrollSyncSourceRef = React.useRef<'source' | 'preview' | null>(null);
  const programmaticScrollTargetRef = React.useRef<HTMLElement | null>(null);
  type CopyState = 'idle' | 'copied' | 'error';
  type CopyStateMap = {
    source: CopyState;
    preview: CopyState;
    compare: CopyState;
    devanagariWhole: CopyState;
    itransWhole: CopyState;
    tamilWhole: CopyState;
  };
  const [copyStates, setCopyStates] = React.useState<CopyStateMap>({
    source: 'idle',
    preview: 'idle',
    compare: 'idle',
    devanagariWhole: 'idle',
    itransWhole: 'idle',
    tamilWhole: 'idle',
  });
  const [isShortcutPeekVisible, setIsShortcutPeekVisible] = React.useState(false);
  const [deleteToastProgress, setDeleteToastProgress] = React.useState(1);
  const [isPredictionPopupVisible, setIsPredictionPopupVisible] = React.useState(false);
  const [isPredictionPopupSuppressed, setIsPredictionPopupSuppressed] = React.useState(false);
  const [predictionPopupPortalStyle, setPredictionPopupPortalStyle] = React.useState<React.CSSProperties>({});
  const [activeQuickSwitchMenu, setActiveQuickSwitchMenu] = React.useState<'read-as' | 'compare' | null>(null);
  const activeBlock = getActiveBlock();
  const activeChunkGroup = getActiveChunkGroup();
  const { focusSpan } = editorState;
  const {
    composerLayout,
    predictionLayout,
    predictionPopupTimeoutMs,
    syncComposerScroll,
    typography,
    inputScheme,
    primaryOutputScript,
    comparisonOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
    sanskritFontPreset,
    tamilFontPreset,
    autoSwapVisargaSvarita,
  } = displaySettings;
  const composerTypography = typography.composer;
  const isStackedComposer = composerLayout === 'stacked';
  const isComposerCompareMode = comparisonOutputScript !== 'off';
  const previewResizeHandleHeight = 16;
  const composerPreviewHeight = Math.max(
    composerTypography.primaryPreviewHeight,
    composerTypography.comparePreviewHeight
  );
  const composerPreviewStackHeight =
    composerPreviewHeight * (isComposerCompareMode ? 2 : 1) + previewResizeHandleHeight;
  const composerInputHeight = composerTypography.itransPanelHeight;
  const updateComposerPreviewHeight = React.useCallback(
    (nextPreviewHeight: number) => {
      const nextStackHeight = nextPreviewHeight * (isComposerCompareMode ? 2 : 1) + previewResizeHandleHeight;
      setTypography('composer', {
        primaryPreviewHeight: nextPreviewHeight,
        comparePreviewHeight: nextPreviewHeight,
        itransPanelHeight: nextStackHeight,
      } as Partial<typeof composerTypography>);
    },
    [isComposerCompareMode, setTypography, previewResizeHandleHeight]
  );
  const updateComposerInputHeight = React.useCallback(
    (nextHeight: number) => {
      const nextPreviewHeight = Math.round(
        (nextHeight - previewResizeHandleHeight) / (isComposerCompareMode ? 2 : 1)
      );
      setTypography('composer', {
        itransPanelHeight: nextHeight,
        primaryPreviewHeight: nextPreviewHeight,
        comparePreviewHeight: nextPreviewHeight,
      } as Partial<typeof composerTypography>);
    },
    [isComposerCompareMode, setTypography, previewResizeHandleHeight]
  );
  const isPredictionListbox = predictionLayout === 'listbox';
  const isLongBlock = activeBlock?.type === 'long';
  const currentChunkSource = activeChunkGroup?.source || '';
  const renderedPreview = transliterate(currentChunkSource, { inputScheme });
  const primaryPreviewText = formatSourceForScript(currentChunkSource, primaryOutputScript, {
    romanOutputStyle,
    tamilOutputStyle,
  });
  const comparisonPreviewText =
    comparisonOutputScript === 'off'
      ? ''
      : formatSourceForScript(currentChunkSource, comparisonOutputScript, {
          romanOutputStyle,
          tamilOutputStyle,
        });
  const quickSwitchLabels = getOutputTargetQuickLabels({
    primaryOutputScript,
    comparisonOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
  });
  const activeComparisonScript = comparisonOutputScript === 'off' ? null : comparisonOutputScript;
  const quickSwitchMenuRef = React.useRef<HTMLDivElement>(null);
  const renderedPreviewChars = Array.from(renderedPreview.unicode);
  const getRenderedLineHeightForScript = React.useCallback(
    (script: typeof primaryOutputScript) =>
      script === 'tamil'
        ? composerTypography.tamilLineHeight
        : composerTypography.devanagariLineHeight,
    [composerTypography.devanagariLineHeight, composerTypography.tamilLineHeight]
  );
  const getRenderedFontSizeForScript = React.useCallback(
    (script: typeof primaryOutputScript) =>
      script === 'tamil'
        ? composerTypography.tamilFontSize
        : composerTypography.devanagariFontSize,
    [composerTypography.devanagariFontSize, composerTypography.tamilFontSize]
  );
  const currentEditTarget: ChunkEditTarget | undefined = activeChunkGroup?.blockId
    ? {
        blockId: activeChunkGroup.blockId,
        startSegmentIndex: activeChunkGroup.startSegmentIndex,
        endSegmentIndex: activeChunkGroup.endSegmentIndex,
        source: activeChunkGroup.source,
      }
    : undefined;
  const resolvePeekMappings = (query: string) =>
    DISPLAY_MAPPINGS
      .filter((mapping) =>
        mapping.itrans.toLowerCase().startsWith(query.toLowerCase()) ||
        getAcceptedInputs(mapping.itrans).some((input) => input.toLowerCase().startsWith(query.toLowerCase())) ||
        (mapping.name || '').toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 6);

  let shortcutPeekState: { query: string; mappings: typeof DISPLAY_MAPPINGS } = {
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
  const composerCompareLayout = isComposerCompareMode ? 'stacked' : 'single';
  const primaryPreviewLabel =
    primaryOutputScript === 'roman'
      ? 'Roman Preview'
      : primaryOutputScript === 'tamil'
        ? 'Tamil Preview'
        : 'Devanagari Preview';
  const comparisonPreviewLabel =
    comparisonOutputScript === 'roman'
      ? 'Roman Compare'
      : comparisonOutputScript === 'tamil'
        ? 'Tamil Compare'
        : comparisonOutputScript === 'devanagari'
          ? 'Devanagari Compare'
          : '';
  const readAsOptions = [
    { script: 'devanagari', label: OUTPUT_TARGET_VALUE_LABELS.devanagari },
    { script: 'tamil', label: OUTPUT_TARGET_VALUE_LABELS.tamil },
  ] as const;
  const compareOptions = [
    { script: 'off', label: OUTPUT_TARGET_VALUE_LABELS.off },
    { script: 'roman', label: OUTPUT_TARGET_VALUE_LABELS.roman },
    { script: 'devanagari', label: OUTPUT_TARGET_VALUE_LABELS.devanagari },
    { script: 'tamil', label: OUTPUT_TARGET_VALUE_LABELS.tamil },
  ] as const;

  const targetCaretIndex = (() => {
    if (composerSelectionStart >= currentChunkSource.length) {
      return renderedPreviewChars.length;
    }

    return renderedPreview.sourceToTargetMap[Math.max(0, composerSelectionStart)] ?? renderedPreviewChars.length;
  })();

  const targetSelectionEndIndex = (() => {
    if (composerSelectionEnd >= currentChunkSource.length) {
      return renderedPreviewChars.length;
    }

    return renderedPreview.sourceToTargetMap[Math.max(0, composerSelectionEnd)] ?? renderedPreviewChars.length;
  })();

  const selectedTargetRange = (() => {
    const start = Math.min(targetCaretIndex, targetSelectionEndIndex);
    const end = Math.max(targetCaretIndex, targetSelectionEndIndex);
    return { start, end };
  })();

  const selectedSourceRange = (() => {
    const start = Math.min(composerSelectionStart, composerSelectionEnd);
    const end = Math.max(composerSelectionStart, composerSelectionEnd);
    return { start, end };
  })();

  const currentSourceWordRange = (() => {
    if (!currentChunkSource || composerSelectionStart !== composerSelectionEnd) {
      return null;
    }

    let anchor = Math.min(composerSelectionStart, currentChunkSource.length - 1);
    if (anchor < 0) {
      return null;
    }

    if (!/\S/.test(currentChunkSource[anchor] ?? '')) {
      anchor -= 1;
    }

    if (anchor < 0 || !/\S/.test(currentChunkSource[anchor] ?? '')) {
      return null;
    }

    let wordStart = anchor;
    while (wordStart > 0 && /\S/.test(currentChunkSource[wordStart - 1])) {
      wordStart -= 1;
    }

    let wordEnd = anchor + 1;
    while (wordEnd < currentChunkSource.length && /\S/.test(currentChunkSource[wordEnd])) {
      wordEnd += 1;
    }

    return wordEnd > wordStart ? { start: wordStart, end: wordEnd } : null;
  })();

  const currentWordTargetRange = (() => {
    if (currentSourceWordRange === null) {
      return null;
    }

    const targetStart = renderedPreview.sourceToTargetMap[currentSourceWordRange.start] ?? 0;
    const targetEnd =
      currentSourceWordRange.end >= currentChunkSource.length
        ? renderedPreviewChars.length
        : renderedPreview.sourceToTargetMap[currentSourceWordRange.end] ?? renderedPreviewChars.length;

    return targetEnd > targetStart ? { start: targetStart, end: targetEnd } : null;
  })();

  const sourceRenderBoundaries = (() => {
    const sourceLength = currentChunkSource.length;
    const boundaries = new Set<number>([
      0,
      sourceLength,
      Math.max(0, Math.min(composerSelectionStart, sourceLength)),
      selectedSourceRange.start,
      selectedSourceRange.end,
    ]);

    if (currentSourceWordRange) {
      boundaries.add(currentSourceWordRange.start);
      boundaries.add(currentSourceWordRange.end);
    }

    return Array.from(boundaries).sort((a, b) => a - b);
  })();

  const sourceMirrorFragments = (() => {
    const sourceLength = currentChunkSource.length;
    const clampedCaret = Math.max(0, Math.min(composerSelectionStart, sourceLength));
    const isCollapsedSelection = composerSelectionStart === composerSelectionEnd;
    const boundaries = new Set<number>([
      0,
      sourceLength,
      clampedCaret,
      selectedSourceRange.start,
      selectedSourceRange.end,
    ]);

    if (currentSourceWordRange) {
      boundaries.add(currentSourceWordRange.start);
      boundaries.add(currentSourceWordRange.end);
    }

    const orderedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
    const fragments: React.ReactNode[] = [];

    for (let index = 0; index < orderedBoundaries.length - 1; index += 1) {
      const start = orderedBoundaries[index];
      const end = orderedBoundaries[index + 1];

      if (isCollapsedSelection && start === clampedCaret) {
        fragments.push(
          <span
            key={`itrans-caret-${start}`}
            aria-hidden="true"
            className="mx-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.08em] rounded-full bg-slate-900 align-middle motion-safe:animate-caret"
            data-testid="itrans-mirror-caret"
          />
        );
      }

      if (end <= start) {
        continue;
      }

      const text = currentChunkSource.slice(start, end);
      const isSelectionVisible =
        selectedSourceRange.end > selectedSourceRange.start &&
        start >= selectedSourceRange.start &&
        end <= selectedSourceRange.end;
      const isCurrentWordVisible =
        !isSelectionVisible &&
        currentSourceWordRange !== null &&
        start >= currentSourceWordRange.start &&
        end <= currentSourceWordRange.end;

      fragments.push(
        <span
          key={`itrans-fragment-${start}-${end}`}
          className={clsx(
            isSelectionVisible && 'rounded-[0.18em] bg-blue-200/80 text-blue-950',
            isCurrentWordVisible && 'font-bold text-[#6b1f1f]'
          )}
          data-source-selection={isSelectionVisible ? 'true' : undefined}
        >
          {text}
        </span>
      );
    }

    if (isCollapsedSelection && clampedCaret === sourceLength) {
      fragments.push(
        <span
          key="itrans-caret-end"
          aria-hidden="true"
          className="mx-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.08em] rounded-full bg-slate-900 align-middle motion-safe:animate-caret"
          data-testid="itrans-mirror-caret"
        />
      );
    }

    return fragments;
  })();

  const syncPaneScroll = React.useCallback(
    (source: HTMLElement, target: HTMLElement | null) => {
      if (!syncComposerScroll || !target) {
        return;
      }

      const sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
      const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
      const progress = sourceRange <= 0 ? 0 : source.scrollTop / sourceRange;
      const nextScrollTop = targetRange * progress;

      if (Math.abs(target.scrollTop - nextScrollTop) < 1) {
        return;
      }

      programmaticScrollTargetRef.current = target;
      target.scrollTop = nextScrollTop;
      window.requestAnimationFrame(() => {
        if (programmaticScrollTargetRef.current === target) {
          programmaticScrollTargetRef.current = null;
        }
      });
    },
    [syncComposerScroll]
  );

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
    if (isPredictionListbox) {
      setIsPredictionPopupVisible(false);
      setIsPredictionPopupSuppressed(true);
    }
    return true;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    setIsPredictionPopupSuppressed(false);
    
    const isDevanagari = /[\u0900-\u097F]/.test(pastedText);
    const isMultiLine = pastedText.includes('\n') || pastedText.includes('\r');

    if (isDevanagari) {
      e.preventDefault();
      const itransText = canonicalizeDevanagariPaste(pastedText);

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
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const isInputKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
      if (isInputKey) {
        setIsPredictionPopupSuppressed(false);
      }
    }

    if (!e.altKey && !e.ctrlKey && !e.metaKey && hasLexicalSuggestions && isPredictionListbox) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const nextIndex =
          (lexicalSelectedSuggestionIndex + direction + lexicalSuggestions.length) % lexicalSuggestions.length;
        setLexicalSelectedSuggestionIndex(nextIndex);
        return;
      }
    }

    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Tab' && hasLexicalSuggestions) {
      e.preventDefault();
      const direction = e.shiftKey ? -1 : 1;
      const nextIndex =
        (lexicalSelectedSuggestionIndex + direction + lexicalSuggestions.length) % lexicalSuggestions.length;
      setLexicalSelectedSuggestionIndex(nextIndex);
      return;
    }

    if (!e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Enter') {
      if (hasLexicalSuggestions) {
        if (acceptLexicalSuggestion(lexicalSelectedSuggestionIndex)) {
          e.preventDefault();
          return;
        }
      }
      
      // If no suggestion accepted and in document mode, split the block
      if (editorState.viewMode === 'document' && activeBlock) {
        e.preventDefault();
        splitBlock(activeBlock.id, composerSelectionStart);
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

      if (isPredictionListbox && isPredictionPopupVisible) {
        e.preventDefault();
        setIsPredictionPopupVisible(false);
        setIsPredictionPopupSuppressed(true);
        return;
      }
    }

    if (e.key === 'Backspace') {
      if (composerSelectionStart === 0 && composerSelectionEnd === 0 && activeBlock) {
        e.preventDefault();
        mergeBlocks(activeBlock.id, 'previous');
        return;
      }

      let charToDelete: string | null = null;
      if (activeBuffer.length > 0) {
        // If there's an active buffer, deleted char is its last char
        charToDelete = activeBuffer.slice(-1);
      } else if (composerSelectionStart > 0) {
        // If no active buffer, deleted char is from main source before cursor
        charToDelete = currentChunkSource.slice(composerSelectionStart - 1, composerSelectionStart);
      }

      if (charToDelete) {
        setDeletedBuffer(charToDelete);
        setIsShortcutPeekVisible(true);
      }
    } else if (e.key === 'Delete') {
      if (composerSelectionStart === currentChunkSource.length && composerSelectionEnd === currentChunkSource.length && activeBlock) {
        e.preventDefault();
        mergeBlocks(activeBlock.id, 'next');
        return;
      }
      setDeletedBuffer(null);
      setIsShortcutPeekVisible(false);
    } else {
      setDeletedBuffer(null);
      setIsShortcutPeekVisible(false);
    }
  };

  const syncSelection = (target: HTMLTextAreaElement) => {
    setComposerSelection(target.selectionStart, target.selectionEnd);
  };

  const finalizePointerSelection = (target: HTMLTextAreaElement) => {
    window.requestAnimationFrame(() => {
      isPointerSelectingRef.current = false;
      syncSelection(target);
    });
  };

  const getTargetCaretForClick = (targetIndex: number, clientX: number, currentTarget: HTMLElement) => {
    const sourceStart = renderedPreview.targetToSourceMap[targetIndex] ?? currentChunkSource.length;
    let sourceEnd = currentChunkSource.length;

    for (let index = targetIndex + 1; index < renderedPreview.targetToSourceMap.length; index += 1) {
      const nextSourceIndex = renderedPreview.targetToSourceMap[index] ?? currentChunkSource.length;
      if (nextSourceIndex > sourceStart) {
        sourceEnd = nextSourceIndex;
        break;
      }
    }

    const rect = currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    return clientX >= midpoint ? sourceEnd : sourceStart;
  };

  const focusComposerAt = (nextCaret: number) => {
    setComposerSelection(nextCaret, nextCaret);
    const applySelection = () => {
      composerRef.current?.focus({ preventScroll: true });
      composerRef.current?.setSelectionRange(nextCaret, nextCaret);
    };

    applySelection();
    requestAnimationFrame(applySelection);
  };

  const handlePreviewCharacterClick = (
    event: React.MouseEvent<HTMLSpanElement>,
    targetIndex: number
  ) => {
    event.preventDefault();
    const nextCaret = getTargetCaretForClick(targetIndex, event.clientX, event.currentTarget);
    focusComposerAt(nextCaret);
  };

  const handleTamilPreviewFragmentClick = (
    event: React.MouseEvent<HTMLSpanElement>,
    start: number,
    end: number,
  ) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const nextCaret = event.clientX >= midpoint ? end : start;
    focusComposerAt(nextCaret);
  };

  const handleTamilPreviewMouseDown = (event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-target-index]');
    if (!target) {
      event.preventDefault();
      focusComposerAt(currentChunkSource.length);
      return;
    }

    const start = Number(target.dataset.targetIndex);
    const end = Number(target.dataset.targetEnd ?? target.dataset.targetIndex);
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return;
    }

    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const nextCaret = event.clientX >= midpoint ? end : start;
    focusComposerAt(nextCaret);
  };

  const handlePrimaryPreviewClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    focusComposerAt(currentChunkSource.length);
  };

  const handleComposerScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (programmaticScrollTargetRef.current === event.currentTarget) {
      return;
    }

    scrollSyncSourceRef.current = 'source';
    if (composerHighlightRef.current) {
      composerHighlightRef.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
    }
    syncPaneScroll(event.currentTarget, previewRef.current);
    window.requestAnimationFrame(() => {
      const preview = previewRef.current;
      if (!preview) {
        return;
      }

      const anchor =
        preview.querySelector<HTMLElement>('[data-current-word="true"]') ??
        preview.querySelector<HTMLElement>(`[data-target-index="${targetCaretIndex}"]`) ??
        preview.querySelector<HTMLElement>('[data-testid="preview-caret"]');

      if (!anchor) {
        return;
      }

      const containerRect = preview.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const isFullyVisible =
        anchorRect.top >= containerRect.top + 8 &&
        anchorRect.bottom <= containerRect.bottom - 8;

      if (!isFullyVisible) {
        anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }
    });
  };

  const handlePreviewScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (programmaticScrollTargetRef.current === event.currentTarget) {
      return;
    }

    scrollSyncSourceRef.current = 'preview';
    syncPaneScroll(event.currentTarget, composerRef.current);
  };

  React.useLayoutEffect(() => {
    if (
      composerRef.current &&
      document.activeElement === composerRef.current &&
      !isPointerSelectingRef.current
    ) {
      if (
        composerRef.current.selectionStart !== composerSelectionStart ||
        composerRef.current.selectionEnd !== composerSelectionEnd
      ) {
        composerRef.current.setSelectionRange(composerSelectionStart, composerSelectionEnd);
      }
    }
  }, [currentChunkSource, composerSelectionStart, composerSelectionEnd]);

  React.useEffect(() => {
    if (!syncComposerScroll) {
      return;
    }

    if (scrollSyncSourceRef.current === 'source' && composerRef.current) {
      syncPaneScroll(composerRef.current, previewRef.current);
      return;
    }

    if (scrollSyncSourceRef.current === 'preview' && previewRef.current) {
      syncPaneScroll(previewRef.current, composerRef.current);
    }
  }, [currentChunkSource, activeChunkGroup?.rendered, syncComposerScroll, syncPaneScroll]);

  React.useEffect(() => {
    if (!composerRef.current || !composerHighlightRef.current) {
      return;
    }

    composerHighlightRef.current.style.transform = `translateY(-${composerRef.current.scrollTop}px)`;
  }, [currentChunkSource, composerSelectionStart, composerSelectionEnd]);

  React.useEffect(() => {
    if (composerLayout === 'side-by-side') {
      if (Math.abs(composerInputHeight - composerPreviewStackHeight) > 2) {
        setTypography('composer', { itransPanelHeight: composerPreviewStackHeight } as Partial<typeof composerTypography>);
      }
    }
  }, [composerLayout, composerPreviewStackHeight, setTypography, composerInputHeight, composerTypography]);

  React.useEffect(() => {
    if (!syncComposerScroll || document.activeElement !== composerRef.current) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      const preview = previewRef.current;
      if (!preview) {
        return;
      }

      const anchor =
        preview.querySelector<HTMLElement>('[data-current-word="true"]') ??
        preview.querySelector<HTMLElement>(`[data-target-index="${targetCaretIndex}"]`) ??
        preview.querySelector<HTMLElement>('[data-testid="preview-caret"]');

      if (!anchor) {
        return;
      }

      const containerRect = preview.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const isFullyVisible =
        anchorRect.top >= containerRect.top + 8 &&
        anchorRect.bottom <= containerRect.bottom - 8;

      if (!isFullyVisible) {
        anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
      }
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [
    composerSelectionStart,
    composerSelectionEnd,
    currentChunkSource,
    currentWordTargetRange?.start,
    currentWordTargetRange?.end,
    syncComposerScroll,
    targetCaretIndex,
  ]);

  React.useEffect(() => {
    if (!isPredictionListbox || !hasLexicalSuggestions || isPredictionPopupSuppressed) {
      setIsPredictionPopupVisible(false);
      return;
    }

    setIsPredictionPopupVisible(true);
  }, [
    activeBuffer,
    composerSelectionStart,
    currentChunkSource,
    hasLexicalSuggestions,
    isPredictionListbox,
    isPredictionPopupSuppressed,
  ]);

  React.useEffect(() => {
    if (!isPredictionListbox || !hasLexicalSuggestions || !isPredictionPopupVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsPredictionPopupVisible(false);
    }, Math.max(1000, predictionPopupTimeoutMs));

    return () => window.clearTimeout(timeoutId);
  }, [
    activeBuffer,
    composerSelectionStart,
    currentChunkSource,
    hasLexicalSuggestions,
    isPredictionListbox,
    isPredictionPopupVisible,
    lexicalSelectedSuggestionIndex,
    predictionPopupTimeoutMs,
  ]);

  React.useLayoutEffect(() => {
    if (!isPredictionListbox || !isPredictionPopupVisible || !sourcePaneRef.current) {
      setPredictionPopupPortalStyle({});
      return;
    }

    const updatePopupPosition = () => {
      if (!sourcePaneRef.current) {
        return;
      }

      const paneRect = sourcePaneRef.current.getBoundingClientRect();
      setPredictionPopupPortalStyle({
        left: paneRect.left + 10,
        top: paneRect.bottom + 6,
        width: Math.min(512, Math.max(300, paneRect.width - 20)),
      });
    };

    updatePopupPosition();
    window.addEventListener('resize', updatePopupPosition);
    window.addEventListener('scroll', updatePopupPosition, true);

    return () => {
      window.removeEventListener('resize', updatePopupPosition);
      window.removeEventListener('scroll', updatePopupPosition, true);
    };
  }, [isPredictionListbox, isPredictionPopupVisible]);

  React.useEffect(() => {
    const hasFeedback = Object.values(copyStates).some((state) => state !== 'idle');
    if (!hasFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyStates({
        source: 'idle',
        preview: 'idle',
        compare: 'idle',
        devanagariWhole: 'idle',
        itransWhole: 'idle',
        tamilWhole: 'idle',
      });
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyStates]);

  React.useEffect(() => {
    if (activeQuickSwitchMenu === null) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (quickSwitchMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setActiveQuickSwitchMenu(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveQuickSwitchMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeQuickSwitchMenu]);

  React.useEffect(() => {
    if (!recentlyDeletedBlock) {
      setDeleteToastProgress(1);
      return;
    }

    const durationMs = 5000;
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

  const handleCopyText = async (text: string, key: keyof CopyStateMap) => {
    if (!text) {
      setCopyStates((current) => ({ ...current, [key]: 'error' }));
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopyStates((current) => ({ ...current, [key]: 'copied' }));
    } catch {
      setCopyStates((current) => ({ ...current, [key]: 'error' }));
    }
  };

  const handleCopySource = async () => {
    await handleCopyText(currentChunkSource, 'source');
  };

  const handleCopyPrimaryPreview = async () => {
    await handleCopyText(primaryPreviewText, 'preview');
  };

  const handleCopyComparison = async () => {
    if (comparisonPreviewText) {
      await handleCopyText(comparisonPreviewText, 'compare');
    }
  };

  const handleCopyWhole = async (script: 'devanagari' | 'itrans' | 'tamil') => {
    const meaningfulBlocks = blocks.filter(b => b.source.trim().length > 0 || b.rendered.trim().length > 0);
    if (meaningfulBlocks.length === 0) {
      setCopyStates(current => ({ ...current, [`${script}Whole` as keyof CopyStateMap]: 'error' }));
      return;
    }

    let text = '';
    if (script === 'itrans') {
      text = meaningfulBlocks.map(b => b.source).join('\n\n');
    } else {
      text = meaningfulBlocks.map(b => formatSourceForScript(b.source, script, {
        romanOutputStyle,
        tamilOutputStyle
      })).join('\n\n');
    }

    await handleCopyText(text, `${script}Whole` as keyof CopyStateMap);
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

  const renderTamilSurface = () => {
    if (!currentChunkSource) {
      return null;
    }

    const fragments: React.ReactNode[] = [];
    for (let index = 0; index < sourceRenderBoundaries.length - 1; index += 1) {
      const start = sourceRenderBoundaries[index];
      const end = sourceRenderBoundaries[index + 1];

      if (end <= start) {
        continue;
      }

      const fragmentSource = currentChunkSource.slice(start, end);
      const fragmentText = formatSourceForScript(fragmentSource, 'tamil', {
        romanOutputStyle,
        tamilOutputStyle,
      });
      const fragmentDisplayText = getScriptDisplayText('tamil', fragmentText);
      const isSelectionVisible =
        selectedSourceRange.end > selectedSourceRange.start &&
        start >= selectedSourceRange.start &&
        end <= selectedSourceRange.end;
      const isCurrentWordVisible =
        !isSelectionVisible &&
        currentSourceWordRange !== null &&
        start >= currentSourceWordRange.start &&
        end <= currentSourceWordRange.end;
      const showCaretBefore = composerSelectionStart === composerSelectionEnd && start === composerSelectionStart;

      if (showCaretBefore) {
        fragments.push(
          <span
            key={`tamil-caret-${start}`}
            aria-hidden="true"
            className="mx-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.08em] rounded-full bg-blue-600 align-middle motion-safe:animate-caret"
            data-testid="preview-caret"
          />
        );
      }

      fragments.push(
        <span
          key={`tamil-fragment-${start}-${end}`}
          className={clsx(
            'cursor-text rounded-[0.18em]',
            isSelectionVisible && 'bg-blue-200/80 text-blue-950',
            isCurrentWordVisible && 'font-semibold text-[#6b1f1f]'
          )}
          data-current-word={isCurrentWordVisible ? 'true' : undefined}
          data-target-index={start}
          data-target-end={end}
          data-source-selection={isSelectionVisible ? 'true' : undefined}
          onMouseDown={(event) => handleTamilPreviewFragmentClick(event, start, end)}
        >
          {fragmentDisplayText}
        </span>
      );
    }

    if (composerSelectionStart === composerSelectionEnd && composerSelectionStart === currentChunkSource.length) {
      fragments.push(
        <span
          key="tamil-caret-end"
          aria-hidden="true"
          className="mx-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.08em] rounded-full bg-blue-600 align-middle motion-safe:animate-caret"
          data-testid="preview-caret"
        />
      );
    }

    return (
      <span
        className="script-text-tamil script-text-wrap whitespace-pre-wrap text-slate-900"
        data-font-preset={tamilFontPreset}
        lang="ta"
        dir="ltr"
        style={{
          fontSize: `${composerTypography.tamilFontSize}px`,
          lineHeight: composerTypography.tamilLineHeight,
        }}
      >
        {fragments}
      </span>
    );
  };

  return (
    <>
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pb-3 pt-3">
        <div className="flex items-center justify-end gap-3 text-sm text-slate-500">
          {isLongBlock && (
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Focus</span>
              <select
                value={focusSpan}
                onChange={(e) => setFocusSpan(e.target.value as 'tight' | 'balanced' | 'wide')}
                className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
              >
                <option value="tight">Tight</option>
                <option value="balanced">Balanced</option>
                <option value="wide">Wide</option>
              </select>
            </div>
          )}
        </div>

        <div
          className={clsx(
            'flex min-h-0 flex-col gap-3 overflow-hidden',
            isStackedComposer ? 'max-h-[82vh]' : 'max-h-[52vh] md:max-h-[54vh]'
          )}
          data-testid="sticky-composer-shell"
          data-layout={composerLayout}
        >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/85 px-3 py-2">
            <div className="flex min-w-0 items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              <span>ITRANS</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-700">Preview</span>
            </div>
            <div ref={quickSwitchMenuRef} className="relative z-40 flex shrink-0 flex-wrap items-center gap-2">
              <div className="relative">
                <button
                  data-testid="sticky-read-as-chip"
                  aria-expanded={activeQuickSwitchMenu === 'read-as'}
                  aria-haspopup="menu"
                  onClick={() =>
                    setActiveQuickSwitchMenu((current) => (current === 'read-as' ? null : 'read-as'))
                  }
                  className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100"
                  type="button"
                >
                  {quickSwitchLabels.readAs}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {activeQuickSwitchMenu === 'read-as' && (
                  <div
                    data-testid="sticky-read-as-menu"
                    className="absolute right-0 top-[calc(100%+0.35rem)] z-[80] min-w-[11rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                  >
                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {OUTPUT_TARGET_CONTROL_LABELS.readAs}
                    </p>
                    <div className="grid gap-1">
                      {readAsOptions.map((option) => (
                        <button
                          key={option.script}
                          type="button"
                          data-testid={`sticky-read-as-option-${option.script}`}
                          aria-pressed={primaryOutputScript === option.script}
                          onClick={() => {
                            setPrimaryOutputScript(option.script);
                            setActiveQuickSwitchMenu(null);
                          }}
                          className={clsx(
                            'rounded-lg px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em]',
                            primaryOutputScript === option.script
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  data-testid="sticky-compare-chip"
                  aria-expanded={activeQuickSwitchMenu === 'compare'}
                  aria-haspopup="menu"
                  onClick={() =>
                    setActiveQuickSwitchMenu((current) => (current === 'compare' ? null : 'compare'))
                  }
                  className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100"
                  type="button"
                >
                  {quickSwitchLabels.compare}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {activeQuickSwitchMenu === 'compare' && (
                  <div
                    data-testid="sticky-compare-menu"
                    className="absolute right-0 top-[calc(100%+0.35rem)] z-[80] min-w-[11rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                  >
                    <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {OUTPUT_TARGET_CONTROL_LABELS.compare}
                    </p>
                    <div className="grid gap-1">
                      {compareOptions.map((option) => (
                        <button
                          key={option.script}
                          type="button"
                          data-testid={`sticky-compare-option-${option.script}`}
                          aria-pressed={comparisonOutputScript === option.script}
                          onClick={() => {
                            setComparisonOutputScript(option.script);
                            setActiveQuickSwitchMenu(null);
                          }}
                          className={clsx(
                            'rounded-lg px-2 py-2 text-left text-[11px] font-bold uppercase tracking-[0.08em]',
                            comparisonOutputScript === option.script
                              ? 'bg-blue-50 text-blue-900'
                              : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                <button
                  onClick={() => handleCopyWhole('devanagari')}
                  className={clsx(
                    "inline-flex touch-manipulation items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97]",
                    copyStates.devanagariWhole === 'copied' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : copyStates.devanagariWhole === 'error'
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-200"
                  )}
                  type="button"
                  title="Copy whole document as Devanagari"
                >
                  {copyStates.devanagariWhole === 'copied' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Devanagari All
                </button>

                <button
                  onClick={() => handleCopyWhole('itrans')}
                  className={clsx(
                    "inline-flex touch-manipulation items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97]",
                    copyStates.itransWhole === 'copied' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : copyStates.itransWhole === 'error'
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-200"
                  )}
                  type="button"
                  title="Copy whole document as ITRANS"
                >
                  {copyStates.itransWhole === 'copied' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  ITRANS All
                </button>

                <button
                  onClick={() => handleCopyWhole('tamil')}
                  className={clsx(
                    "inline-flex touch-manipulation items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] transition-all active:scale-[0.97]",
                    copyStates.tamilWhole === 'copied' 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                      : copyStates.tamilWhole === 'error'
                        ? "bg-rose-50 text-rose-700 border-rose-200"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-blue-700 hover:border-blue-200"
                  )}
                  type="button"
                  title="Copy whole document as Tamil"
                >
                  {copyStates.tamilWhole === 'copied' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  Tamil All
                </button>
              </div>

              <button
                onClick={() => {
                  setActiveQuickSwitchMenu(null);
                  toggleReferencePanel();
                }}
                className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100"
                type="button"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Reference
              </button>
            </div>
          </div>

          <div
            className={clsx(
              'grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.45)]',
              isStackedComposer
                ? 'grid-cols-1 gap-3 p-3'
                : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]'
            )}
          >
            <div
              ref={sourcePaneRef}
              className={clsx(
                'group relative flex min-h-0 flex-col gap-3 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white/95 p-3 shadow-sm',
                isStackedComposer ? 'flex-auto min-h-[12rem]' : 'flex-1 min-h-0'
              )}
            >
              <div className="flex items-start justify-between gap-3 px-1">
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">ITRANS Input</p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      Type in ITRANS here. The live preview mirrors the active chunk.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-1.5 transition-colors hover:bg-slate-100">
                    <input
                      type="checkbox"
                      checked={autoSwapVisargaSvarita}
                      onChange={(e) => setAutoSwapVisargaSvarita(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-600">Auto-swap markers</span>
                  </label>
                </div>
              </div>
              <div
                ref={itransPanelRef}
                className="relative flex-none overflow-hidden rounded-[1.125rem] border border-blue-200 bg-gradient-to-b from-blue-50/90 to-white shadow-sm"
                data-testid="sticky-itrans-panel"
                style={{ height: `${composerInputHeight}px` }}
              >
                <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    data-testid="copy-source-button"
                    onClick={handleCopySource}
                    className={clsx(
                      'pointer-events-auto rounded-md border bg-white/95 p-1.5 shadow-sm',
                      copyStates.source === 'copied'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : copyStates.source === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-blue-200 text-slate-700 hover:bg-blue-100'
                    )}
                    type="button"
                    aria-label="Copy ITRANS source"
                    title={copyStates.source === 'copied' ? 'Copied' : copyStates.source === 'error' ? 'Copy failed' : 'Copy ITRANS source'}
                  >
                    {copyStates.source === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div className="flex h-[calc(100%-1rem)] min-h-0 flex-col">
                  <div className="relative flex-1 min-h-0">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.125rem] py-2.5 pl-3 pr-7 font-mono text-lg text-slate-900 md:pr-8"
                      style={{
                        fontSize: `${composerTypography.itransFontSize}px`,
                        lineHeight: composerTypography.itransLineHeight,
                      }}
                    >
                      <div ref={composerHighlightRef} className="whitespace-pre-wrap break-words">
                        {sourceMirrorFragments}
                      </div>
                    </div>
                    <textarea
                      ref={composerRef}
                      data-testid="sticky-itrans-input"
                      className="relative z-10 h-full w-full overflow-y-auto rounded-[1.125rem] bg-transparent px-3 py-2.5 font-mono text-lg text-transparent caret-transparent outline-none selection:bg-blue-200/80 selection:text-transparent placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
                      style={{
                        fontSize: `${composerTypography.itransFontSize}px`,
                        lineHeight: composerTypography.itransLineHeight,
                      }}
                      value={activeChunkGroup?.source || ''}
                      onChange={(e) => updateChunkSource(e.target.value, e.target.selectionStart, e.target.selectionEnd, currentEditTarget)}
                      onPaste={handlePaste}
                      onKeyDown={handleKeyDown}
                      onScroll={handleComposerScroll}
                      onSelect={(e) => syncSelection(e.currentTarget)}
                      onPointerDown={() => {
                        isPointerSelectingRef.current = true;
                      }}
                      onPointerUp={(e) => finalizePointerSelection(e.currentTarget)}
                      onPointerCancel={() => {
                        isPointerSelectingRef.current = false;
                      }}
                      onClick={(e) => finalizePointerSelection(e.currentTarget)}
                      onKeyUp={(e) => syncSelection(e.currentTarget)}
                      onFocus={(e) => {
                        if (!isPointerSelectingRef.current) {
                          syncSelection(e.currentTarget);
                        }
                      }}
                      rows={Math.min(6, Math.max(1, currentChunkSource.split('\n').length))}
                      placeholder="Type ITRANS here..."
                    />
                  </div>
                </div>
                <VerticalResizeHandle
                  height={composerInputHeight}
                  minHeight={140}
                  maxHeight={360}
                  ariaLabel="Resize ITRANS input height"
                  onHeightChange={updateComposerInputHeight}
                  placement="corner"
                />
              </div>
              {predictionLayout === 'inline' && <WordPredictionTray variant="inline" />}
              {predictionLayout === 'split' && <WordPredictionTray variant="split" />}
            </div>

            {!isStackedComposer && <div className="hidden bg-slate-200/80 lg:block" aria-hidden="true" />}

            <div
              className={clsx(
                'group flex min-h-0 flex-col gap-3 overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white/95 p-3 text-blue-800 shadow-sm',
                isStackedComposer ? 'flex-auto border-slate-200' : 'flex-1 lg:border-l-0 lg:border-t-0 lg:rounded-l-none'
              )}
            >
              <div className="min-w-0 px-1">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                  {isComposerCompareMode ? `${primaryPreviewLabel} / ${comparisonPreviewLabel}` : primaryPreviewLabel}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {isComposerCompareMode
                    ? 'Primary output sits above the comparison pane with matched widths and separate copy actions.'
                    : 'Rendered output for the active chunk, tuned to the current Read As target.'}
                </p>
              </div>
              <div
                className="relative flex-none overflow-hidden rounded-[1.125rem] border border-blue-100 bg-gradient-to-b from-blue-50/90 to-white shadow-sm"
                data-testid="sticky-preview-primary-wrapper"
                style={{ height: `${composerPreviewStackHeight}px` }}
              >
                <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    onClick={handleCopyPrimaryPreview}
                    className={clsx(
                      'pointer-events-auto rounded-md border bg-white/95 p-1.5 shadow-sm',
                      copyStates.preview === 'copied'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : copyStates.preview === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-blue-200 text-slate-700 hover:bg-blue-100'
                    )}
                    type="button"
                    aria-label={`Copy ${primaryPreviewLabel}`}
                    title={copyStates.preview === 'copied' ? 'Copied' : copyStates.preview === 'error' ? 'Copy failed' : `Copy ${primaryPreviewLabel}`}
                  >
                    {copyStates.preview === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleDeleteBlock}
                    className="pointer-events-auto rounded-md border border-rose-200 bg-white/95 p-1.5 text-rose-700 shadow-sm hover:bg-rose-100"
                    type="button"
                    aria-label="Delete active block"
                    title="Delete block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div
                  data-testid="sticky-preview-surface"
                  data-compare-mode={isComposerCompareMode ? 'compare' : 'single'}
                  data-compare-layout={composerCompareLayout}
                  className="flex h-full flex-col"
                >
                  <div
                    ref={previewRef}
                    className="overflow-y-auto rounded-[1.125rem] border border-blue-100/80 bg-white/65 px-3 pb-3 pt-2.5 shadow-inner"
                    data-testid="sticky-preview-primary-pane"
                    onPointerDownCapture={primaryOutputScript === 'tamil' ? handleTamilPreviewMouseDown : undefined}
                    onScroll={handlePreviewScroll}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={
                      primaryOutputScript === 'devanagari' || primaryOutputScript === 'tamil'
                        ? handlePrimaryPreviewClick
                        : undefined
                    }
                    style={{
                      height: `${composerPreviewHeight}px`,
                      fontSize: `${getRenderedFontSizeForScript(primaryOutputScript)}px`,
                      lineHeight: getRenderedLineHeightForScript(primaryOutputScript),
                    }}
                  >
                    {primaryOutputScript === 'devanagari' ? (
                      renderedPreviewChars.length === 0 ? (
                        'Devanagari preview'
                      ) : (
                      <span
                        className="script-text-devanagari whitespace-pre-wrap break-words text-slate-900"
                        data-font-preset={sanskritFontPreset}
                        lang="sa"
                        style={{
                          fontSize: `${composerTypography.devanagariFontSize}px`,
                          lineHeight: composerTypography.devanagariLineHeight,
                          }}
                        >
                          {renderedPreviewChars.map((char, index) => {
                            const isSelectionVisible =
                              selectedTargetRange.end > selectedTargetRange.start &&
                              index >= selectedTargetRange.start &&
                              index < selectedTargetRange.end;
                            const isCurrentWordVisible =
                              !isSelectionVisible &&
                              currentWordTargetRange !== null &&
                              index >= currentWordTargetRange.start &&
                              index < currentWordTargetRange.end;
                            const showCaretBefore = index === targetCaretIndex;

                            return (
                              <span
                                key={`${index}-${char}`}
                                className={clsx(
                                  'relative cursor-text rounded-[0.18em] transition-colors',
                                  isSelectionVisible && 'bg-blue-200/80 text-blue-950',
                                  isCurrentWordVisible && 'font-semibold text-[#6b1f1f]'
                                )}
                                data-current-word={isCurrentWordVisible ? 'true' : undefined}
                                data-target-index={index}
                                onClick={(event) => handlePreviewCharacterClick(event, index)}
                              >
                                {showCaretBefore && (
                                  <span
                                    aria-hidden="true"
                                    className="pointer-events-none absolute -left-[2px] top-1/2 inline-block h-[1.1em] w-[2px] -translate-y-1/2 rounded-full bg-blue-600 motion-safe:animate-caret"
                                    data-testid="preview-caret"
                                  />
                                )}
                                {char === ' ' ? '\u00A0' : char}
                              </span>
                            );
                          })}
                          {targetCaretIndex === renderedPreviewChars.length && (
                            <span
                              aria-hidden="true"
                              className="mx-[1px] inline-block h-[1.1em] w-[2px] translate-y-[0.08em] rounded-full bg-blue-600 align-middle motion-safe:animate-caret"
                              data-testid="preview-caret"
                            />
                          )}
                        </span>
                      )
                    ) : primaryOutputScript === 'tamil' ? (
                      renderTamilSurface() ?? 'Tamil preview'
                    ) : (
                      <ScriptText
                        script={primaryOutputScript}
                        sanskritFontPreset={sanskritFontPreset}
                        tamilFontPreset={tamilFontPreset}
                        text={primaryPreviewText || 'Roman preview'}
                        className="text-slate-900"
                        style={{
                          fontSize: `${composerTypography.devanagariFontSize}px`,
                          lineHeight: composerTypography.devanagariLineHeight,
                        }}
                      />
                    )}
                  </div>
                  <VerticalResizeHandle
                    height={composerPreviewHeight}
                    minHeight={140}
                    maxHeight={360}
                    ariaLabel="Resize primary preview height"
                    onHeightChange={updateComposerPreviewHeight}
                  />

                  {isComposerCompareMode && (
                    <div
                      className="relative overflow-y-auto rounded-[1.125rem] border border-blue-100/80 bg-white/60 px-3 pb-3 pt-2.5 text-slate-700 shadow-inner"
                      data-testid="sticky-preview-compare-pane"
                      onPointerDownCapture={activeComparisonScript === 'tamil' ? handleTamilPreviewMouseDown : undefined}
                      onClick={activeComparisonScript === 'tamil' ? handlePrimaryPreviewClick : undefined}
                      style={{
                        height: `${composerPreviewHeight}px`,
                        fontSize: `${Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14)}px`,
                        lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                      }}
                    >
                      <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          onClick={handleCopyComparison}
                          className={clsx(
                            'pointer-events-auto rounded-md border bg-white/95 p-1.5 shadow-sm',
                            copyStates.compare === 'copied'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : copyStates.compare === 'error'
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-blue-200 text-slate-700 hover:bg-blue-100'
                          )}
                          type="button"
                          aria-label={`Copy ${comparisonPreviewLabel}`}
                          title={copyStates.compare === 'copied' ? 'Copied' : copyStates.compare === 'error' ? 'Copy failed' : `Copy ${comparisonPreviewLabel}`}
                        >
                          {copyStates.compare === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {activeComparisonScript === 'tamil' ? (
                        renderTamilSurface() ?? 'Tamil compare'
                      ) : (
                        <ScriptText
                          script={activeComparisonScript ?? primaryOutputScript}
                          sanskritFontPreset={sanskritFontPreset}
                          tamilFontPreset={tamilFontPreset}
                          text={comparisonPreviewText}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
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

          <ShortcutHUD />
        </div>

        {/* Chunk Navigation Controls */}
        <div className="flex items-center justify-between text-sm text-slate-500">
          {isLongBlock && (
            <div className="flex gap-2">
              <button onClick={setPrevChunk} className="flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 hover:bg-slate-200">
                <ChevronLeft className="w-4 h-4" /> Prev Chunk
              </button>
              <button onClick={setNextChunk} className="flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1 hover:bg-slate-200">
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
    {isPredictionListbox &&
      isPredictionPopupVisible &&
      typeof document !== 'undefined' &&
      createPortal(
        <div className="pointer-events-none fixed z-[120]" style={predictionPopupPortalStyle}>
          <WordPredictionTray
            variant="listbox"
            className="pointer-events-auto max-h-[12rem] bg-white/98 backdrop-blur-sm"
            onSuggestionAccepted={() => {
              setIsPredictionPopupVisible(false);
              setIsPredictionPopupSuppressed(true);
            }}
          />
        </div>,
        document.body
      )}
    </>
  );
};
