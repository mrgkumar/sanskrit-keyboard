// app/src/components/StickyTopComposer.tsx
'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useFlowStore } from '@/store/useFlowStore';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, Undo2 } from 'lucide-react';
import { clsx } from 'clsx';
import { ShortcutHUD } from '@/components/engine/ShortcutHUD';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';
import { ScriptText } from '@/components/ScriptText';
import {
  canonicalizeDevanagariPaste,
  formatSourceForPrimaryOutput,
  formatSourceForScript,
  getCopySourceControlText,
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
    getActiveBlock, getActiveChunkGroup, updateChunkSource, setNextChunk, setPrevChunk, setNextBlock, setPrevBlock, setFocusSpan, toggleReferencePanel, addBlocks, deleteBlock, restoreDeletedBlock, dismissDeletedBlock, setDeletedBuffer, setComposerSelection, setLexicalSelectedSuggestionIndex, recordSessionLexicalText, recordSessionLexicalUse, setPrimaryOutputScript, setComparisonOutputScript, editorState,
    activeBuffer, // Get activeBuffer for Backspace logic
    lexicalSuggestions,
    lexicalSelectedSuggestionIndex,
    deletedBuffer,
    isReferencePanelOpen, // To check if panel is open
    composerSelectionStart,
    composerSelectionEnd,
    recentlyDeletedBlock,
    displaySettings,
  } = useFlowStore();
  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const composerHighlightRef = React.useRef<HTMLDivElement>(null);
  const sourcePaneRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const isPointerSelectingRef = React.useRef(false);
  const scrollSyncSourceRef = React.useRef<'source' | 'preview' | null>(null);
  const programmaticScrollTargetRef = React.useRef<HTMLElement | null>(null);
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle');
  const [isShortcutPeekVisible, setIsShortcutPeekVisible] = React.useState(false);
  const [deleteToastProgress, setDeleteToastProgress] = React.useState(1);
  const [isPredictionPopupVisible, setIsPredictionPopupVisible] = React.useState(false);
  const [isPredictionPopupSuppressed, setIsPredictionPopupSuppressed] = React.useState(false);
  const [predictionPopupPortalStyle, setPredictionPopupPortalStyle] = React.useState<React.CSSProperties>({});
  const [activeQuickSwitchMenu, setActiveQuickSwitchMenu] = React.useState<'read-as' | 'compare' | null>(null);
  const activeBlock = getActiveBlock();
  const activeChunkGroup = getActiveChunkGroup();
  const { focusSpan, viewMode } = editorState;
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
  } = displaySettings;
  const composerTypography = typography.composer;
  const isPredictionListbox = predictionLayout === 'listbox';
  const isLongBlock = activeBlock?.type === 'long';
  const currentChunkSource = activeChunkGroup?.source || '';
  const renderedPreview = transliterate(currentChunkSource, { inputScheme });
  const copySourceControlText = getCopySourceControlText({
    primaryOutputScript,
    comparisonOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
  });
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
    (script: typeof primaryOutputScript, baseLineHeight: number) =>
      script === 'tamil' ? Math.max(baseLineHeight, 1.95) : baseLineHeight,
    []
  );
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
  const isComposerCompareMode = comparisonOutputScript !== 'off';
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

      if (isPredictionListbox && isPredictionPopupVisible) {
        e.preventDefault();
        setIsPredictionPopupVisible(false);
        setIsPredictionPopupSuppressed(true);
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
    requestAnimationFrame(() => {
      composerRef.current?.focus();
      composerRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  const handlePreviewCharacterClick = (
    event: React.MouseEvent<HTMLSpanElement>,
    targetIndex: number
  ) => {
    event.preventDefault();
    const nextCaret = getTargetCaretForClick(targetIndex, event.clientX, event.currentTarget);
    focusComposerAt(nextCaret);
  };

  const handlePreviewContainerClick = (event: React.MouseEvent<HTMLDivElement>) => {
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
    if (copyState === 'idle') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState('idle');
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copyState]);

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

  const handleCopyRendered = async () => {
    const canonicalSource = viewMode === 'focus'
      ? activeChunkGroup?.source || ''
      : activeBlock?.source || '';
    const textToCopy = formatSourceForScript(canonicalSource, primaryOutputScript, {
      romanOutputStyle,
      tamilOutputStyle,
    });

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

  const handleCopySource = async () => {
    const sourceToCopy = formatSourceForPrimaryOutput(currentChunkSource, {
      primaryOutputScript,
      comparisonOutputScript,
      romanOutputStyle,
      tamilOutputStyle,
    });

    if (!sourceToCopy) {
      setCopyState('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(sourceToCopy);
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
          className="flex min-h-0 max-h-[52vh] flex-col gap-3 overflow-hidden md:max-h-[54vh]"
          data-testid="sticky-composer-shell"
          data-layout={composerLayout}
        >
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/85 px-3 py-2">
            <div className="flex min-w-0 items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              <span>ITRANS</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-700">Preview</span>
            </div>
            <div ref={quickSwitchMenuRef} className="relative z-10 flex shrink-0 items-center gap-2">
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
                    className="absolute right-0 top-[calc(100%+0.35rem)] min-w-[11rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
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
                    className="absolute right-0 top-[calc(100%+0.35rem)] min-w-[11rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
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
              'grid min-h-0 flex-1 gap-0 overflow-visible rounded-2xl border border-slate-200 bg-slate-50/70',
              composerLayout === 'stacked'
                ? 'grid-cols-1'
                : 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]'
            )}
          >
            <div ref={sourcePaneRef} className="group relative flex min-h-0 flex-1 flex-col gap-2 p-2.5">
              <div className="flex items-center justify-between gap-3 px-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">ITRANS Input</p>
              </div>
              <div className="relative min-h-[7rem] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    data-testid="copy-source-button"
                    onClick={handleCopySource}
                    className={clsx(
                      'pointer-events-auto rounded-md border bg-white/95 p-1.5 shadow-sm',
                      copyState === 'copied'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : copyState === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-blue-200 text-slate-700 hover:bg-blue-100'
                    )}
                    type="button"
                    aria-label={copySourceControlText.ariaLabel}
                    title={
                      copyState === 'copied'
                        ? 'Copied'
                        : copyState === 'error'
                          ? 'Copy failed'
                          : copySourceControlText.title
                    }
                  >
                    {copyState === 'copied' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl py-2.5 pl-3 pr-7 font-mono text-lg text-slate-900 md:pr-8"
                  style={{
                    fontSize: `${composerTypography.itransFontSize}px`,
                    lineHeight: composerTypography.itransLineHeight,
                  }}
                >
                  <div
                    ref={composerHighlightRef}
                    className="whitespace-pre-wrap break-words"
                  >
                    {sourceMirrorFragments}
                  </div>
                </div>
                <textarea
                  key={textareaKey}
                  ref={composerRef}
                  autoFocus
                  data-testid="sticky-itrans-input"
                  className="relative z-10 min-h-[7rem] h-full w-full overflow-y-auto rounded-xl bg-transparent px-3 py-2.5 font-mono text-lg text-transparent caret-transparent shadow-sm outline-none selection:bg-blue-200/80 selection:text-transparent placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500"
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
              {predictionLayout === 'inline' && <WordPredictionTray variant="inline" />}
              {predictionLayout === 'split' && <WordPredictionTray variant="split" />}
            </div>

            {composerLayout !== 'stacked' && <div className="hidden bg-slate-200 lg:block" aria-hidden="true" />}

            <div className="group flex min-h-0 flex-1 flex-col gap-2 border-t border-slate-200 p-2.5 text-blue-800 lg:border-t-0">
              <div className="min-w-0 px-1">
                <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                  {isComposerCompareMode ? `${primaryPreviewLabel} / ${comparisonPreviewLabel}` : primaryPreviewLabel}
                </p>
              </div>
              <div className="relative min-h-[7rem] flex-1">
                <div className="pointer-events-none absolute right-2 top-2 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    onClick={handleDeleteBlock}
                    className="pointer-events-auto rounded-md border border-rose-200 bg-white/95 p-1.5 text-rose-700 shadow-sm hover:bg-rose-100"
                    type="button"
                    aria-label="Delete active block"
                    title="Delete block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCopyRendered}
                    className={clsx(
                      'pointer-events-auto rounded-md border bg-white/95 p-1.5 shadow-sm',
                      copyState === 'copied'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : copyState === 'error'
                          ? 'border-rose-200 bg-rose-50 text-rose-700'
                          : 'border-blue-200 text-slate-700 hover:bg-blue-100'
                    )}
                    type="button"
                    aria-label={`Copy ${primaryPreviewLabel}`}
                    title={copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : `Copy ${primaryPreviewLabel}`}
                  >
                    {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div
                  data-testid="sticky-preview-surface"
                  data-compare-mode={isComposerCompareMode ? 'compare' : 'single'}
                  data-compare-layout={composerCompareLayout}
                  className={clsx(
                    'grid min-h-[7rem] h-full gap-3',
                    'grid-cols-1'
                  )}
                >
                  <div
                    ref={previewRef}
                    className="min-h-[7rem] h-full overflow-y-auto rounded-xl border border-blue-100 bg-white px-3 pb-3 pt-2.5 pr-14 shadow-sm"
                    data-testid="sticky-preview-primary-pane"
                    onScroll={handlePreviewScroll}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={primaryOutputScript === 'devanagari' ? handlePreviewContainerClick : undefined}
                    style={{
                      fontSize: `${composerTypography.renderedFontSize}px`,
                      lineHeight: getRenderedLineHeightForScript(primaryOutputScript, composerTypography.renderedLineHeight),
                    }}
                  >
                    <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-blue-700">
                      {primaryPreviewLabel}
                    </p>
                    {primaryOutputScript === 'tamil' && (
                      <p className="mb-2 text-[11px] text-amber-700">
                        Tamil preview is read-only. Cursor-linked navigation and highlight stay Devanagari-only.
                      </p>
                    )}
                    {primaryOutputScript === 'devanagari' ? (
                      renderedPreviewChars.length === 0 ? (
                        'Devanagari preview'
                      ) : (
                        <span
                          className="script-text-devanagari whitespace-pre-wrap break-words text-slate-900"
                          data-font-preset={sanskritFontPreset}
                          lang="sa"
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
                    ) : (
                      <ScriptText
                        script={primaryOutputScript}
                        sanskritFontPreset={sanskritFontPreset}
                        tamilFontPreset={tamilFontPreset}
                        text={primaryPreviewText || (primaryOutputScript === 'tamil' ? 'Tamil preview' : 'Roman preview')}
                        className="text-slate-900"
                      />
                    )}
                  </div>

                  {isComposerCompareMode && (
                    <div
                      className="min-h-[7rem] h-full overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 pb-3 pt-2.5 text-slate-700 shadow-sm"
                      data-testid="sticky-preview-compare-pane"
                      style={{
                        fontSize: `${Math.max(composerTypography.renderedFontSize - 2, 14)}px`,
                        lineHeight: getRenderedLineHeightForScript(
                          activeComparisonScript ?? primaryOutputScript,
                          composerTypography.renderedLineHeight
                        ),
                      }}
                    >
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        {comparisonPreviewLabel}
                      </p>
                      <ScriptText
                        script={activeComparisonScript ?? primaryOutputScript}
                        sanskritFontPreset={sanskritFontPreset}
                        tamilFontPreset={tamilFontPreset}
                        text={comparisonPreviewText}
                      />
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
