// app/src/components/StickyTopComposer.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Trash2, Undo2, HelpCircle, Bug } from 'lucide-react';
import { clsx } from 'clsx';
import Link from 'next/link';
import { CaretOverlay } from '@/components/engine/CaretOverlay';
import { ShortcutHUD } from '@/components/engine/ShortcutHUD';
import { StickyTopComposerPredictionPopup } from '@/components/engine/StickyTopComposerPredictionPopup';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';
import { getScriptDisplayText } from '@/components/ScriptText';
import { ResizeHandle } from '@/components/VerticalResizeHandle';
import { useStickyComposerLayout } from '@/components/engine/useStickyComposerLayout';
import {
  canonicalizeDevanagariPaste,
  formatSourceForScript,
  normalizeMarkerSequences,
  normalizeDevanagariDisplayResult,
  transliterate,
} from '@/lib/vedic/utils';
import {
  getOutputTargetQuickLabels,
  OUTPUT_TARGET_CONTROL_LABELS,
  OUTPUT_TARGET_VALUE_LABELS,
} from '@/lib/vedic/mapping';
import type { ChunkEditTarget } from '@/store/types';

export const StickyTopComposer: React.FC = () => {
  const { 
    blocks,
    getActiveBlock, getActiveChunkGroup, updateChunkSource, setNextChunk, setPrevChunk, setNextBlock, setPrevBlock, setFocusSpan, toggleReferencePanel, addBlocks, deleteBlock, mergeBlocks, splitBlock, restoreDeletedBlock, dismissDeletedBlock, setDeletedBuffer, setComposerSelection, setLexicalSelectedSuggestionIndex, recordSessionLexicalText, recordSessionLexicalUse, setPrimaryOutputScript, setComparisonOutputScript, editorState,
    activeBuffer, // Get activeBuffer for Backspace logic
    lexicalSuggestions,
    lexicalSelectedSuggestionIndex,
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
  const composerSplitContainerRef = React.useRef<HTMLDivElement>(null);
  const previewRef = React.useRef<HTMLDivElement>(null);
  const comparePreviewRef = React.useRef<HTMLDivElement>(null);
  const itransPanelRef = React.useRef<HTMLDivElement>(null);
  const mirrorCaretRef = React.useRef<HTMLSpanElement>(null);
  const primaryPreviewCaretRef = React.useRef<HTMLSpanElement>(null);
  const comparisonPreviewCaretRef = React.useRef<HTMLSpanElement>(null);
  const isPointerSelectingRef = React.useRef(false);
  const isProgrammaticSelectionRef = React.useRef(false);

  const [showShiftEnterHint, setShowShiftEnterHint] = React.useState(false);
  const hintTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const triggerShiftEnterHint = React.useCallback(() => {
    setShowShiftEnterHint(true);
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
    }
    hintTimeoutRef.current = setTimeout(() => setShowShiftEnterHint(false), 3000);
  }, []);
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
  const {
    composerComparePreviewHeight,
    composerInputHeight,
    composerPreviewStackHeight,
    composerPrimaryPreviewHeight,
    composerSourcePaneWidth,
    composerSplitRatio,
    composerSplitDividerWidth,
    composerSplitMaxSourceWidth,
    composerSplitMinPaneWidth,
    previewMinHeight,
    previewSplitMaxHeight,
    updateComposerInputHeight,
    updateComposerPreviewSplitHeight,
    updateComposerSplitWidth,
  } = useStickyComposerLayout({
    composerSplitContainerRef,
    composerTypography,
    isComposerCompareMode,
    isStackedComposer,
    setTypography,
  });
  const isPredictionListbox = predictionLayout === 'listbox';
  const isLongBlock = activeBlock?.type === 'long';
  const currentChunkSource = activeChunkGroup?.source || '';
  const renderedPreview = normalizeDevanagariDisplayResult(
    transliterate(currentChunkSource, { inputScheme }),
    sanskritFontPreset,
  );
  const primaryPreviewText = formatSourceForScript(currentChunkSource, primaryOutputScript, {
    romanOutputStyle,
    tamilOutputStyle,
  }, {
    sanskritFontPreset,
  });
  const comparisonPreviewText =
    comparisonOutputScript === 'off'
      ? ''
      : formatSourceForScript(currentChunkSource, comparisonOutputScript, {
          romanOutputStyle,
          tamilOutputStyle,
        }, {
          sanskritFontPreset,
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
  const composerSplitGridTemplateColumns = isStackedComposer
    ? undefined
    : `minmax(0, ${composerSplitRatio}fr) ${composerSplitDividerWidth}px minmax(0, ${1 - composerSplitRatio}fr)`;

  const targetCaretIndex = (() => {
    if (composerSelectionStart >= currentChunkSource.length) {
      return renderedPreviewChars.length;
    }

    return renderedPreview.sourceToTargetMap[Math.max(0, composerSelectionStart)] ?? renderedPreviewChars.length;
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
  const previewWordRanges = React.useMemo(() => {
    const ranges: Array<{ start: number; end: number }> = [];
    const source = currentChunkSource;
    const wordPattern = /\S+/g;
    let match: RegExpExecArray | null;

    while ((match = wordPattern.exec(source)) !== null) {
      ranges.push({
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return ranges;
  }, [currentChunkSource]);

  const getPreviewWordRangeFromPoint = React.useCallback(
    (event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-source-start]');
      if (!target) {
        return null;
      }

      const sourceStart = Number(target.dataset.sourceStart);
      const sourceEnd = Number(target.dataset.sourceEnd);
      if (Number.isNaN(sourceStart) || Number.isNaN(sourceEnd)) {
        return null;
      }

      const rect = target.getBoundingClientRect();
      const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0.5;
      const nextCaret = Math.round(sourceStart + (sourceEnd - sourceStart) * ratio);

      return {
        start: sourceStart,
        end: sourceEnd,
        caret: Math.max(sourceStart, Math.min(sourceEnd, nextCaret)),
      };
    },
    []
  );

  const renderPreviewWordSegments = React.useCallback(
    (
      script: typeof primaryOutputScript,
      options: {
        sourceText: string;
        fontSize: number;
        lineHeight: number;
        sanskritFontPreset?: typeof sanskritFontPreset;
        tamilFontPreset?: typeof tamilFontPreset;
        activeWordRange?: { start: number; end: number } | null;
        caretRef?: React.RefObject<HTMLSpanElement | null>;
      }
    ) => {
      const { sourceText, fontSize, lineHeight, sanskritFontPreset: fontPreset, tamilFontPreset: tamilPreset, activeWordRange, caretRef } = options;
      const nodes: React.ReactNode[] = [];
      let cursor = 0;

      const pushText = (text: string, key: string) => {
        if (!text) {
          return;
        }

        nodes.push(
          <span key={key}>
            {formatSourceForScript(text, script, {
              romanOutputStyle,
              tamilOutputStyle,
            }, {
              sanskritFontPreset,
            })}
          </span>
        );
      };

      if (previewWordRanges.length === 0) {
        return [
          <span
            key="preview-empty"
            className={clsx(
              script === 'devanagari'
                ? 'font-serif script-text-devanagari'
                : script === 'tamil'
                  ? 'font-tamil-reading script-text-tamil'
                  : 'font-mono',
              'whitespace-pre-wrap break-words text-slate-900'
            )}
            data-font-preset={script === 'tamil' ? tamilPreset : fontPreset}
            lang={script === 'devanagari' ? 'sa' : script === 'tamil' ? 'ta' : undefined}
            dir={script === 'tamil' ? 'ltr' : undefined}
            style={{ fontSize: `${fontSize}px`, lineHeight }}
          >
            {formatSourceForScript(sourceText, script, {
              romanOutputStyle,
              tamilOutputStyle,
            }, {
              sanskritFontPreset,
            })}
          </span>
        ];
      }

      for (const range of previewWordRanges) {
        if (cursor < range.start) {
          pushText(sourceText.slice(cursor, range.start), `preview-gap-${cursor}-${range.start}`);
        }

        const wordText = formatSourceForScript(sourceText.slice(range.start, range.end), script, {
          romanOutputStyle,
          tamilOutputStyle,
        }, {
          sanskritFontPreset,
        });
        const isActiveWord = activeWordRange?.start === range.start && activeWordRange?.end === range.end;
        nodes.push(
          <span
            key={`preview-word-${range.start}-${range.end}`}
            data-source-start={range.start}
            data-source-end={range.end}
            data-target-index={script === 'devanagari' ? renderedPreview.sourceToTargetMap[range.start] ?? range.start : undefined}
            data-current-word={isActiveWord ? 'true' : undefined}
            className={clsx(
              'rounded-sm px-0.5 -mx-0.5',
              isActiveWord && 'font-bold text-[#6b1f1f] bg-yellow-100/40'
            )}
          >
            {wordText}
            {cursor === range.start && caretRef ? <span ref={caretRef} className="inline-block w-0" /> : null}
          </span>
        );

        cursor = range.end;
      }

      if (cursor < sourceText.length) {
        pushText(sourceText.slice(cursor), `preview-tail-${cursor}-${sourceText.length}`);
      }

      return nodes;
    },
    [previewWordRanges, renderedPreview.sourceToTargetMap, romanOutputStyle, tamilOutputStyle, sanskritFontPreset]
  );

  const renderPreviewVisibleText = React.useCallback(
    (
      script: typeof primaryOutputScript,
      sourceText: string,
      activeWordRange?: { start: number; end: number } | null
    ) => {
      const formatText = (value: string) => {
        const formatted = formatSourceForScript(value, script, {
          romanOutputStyle,
          tamilOutputStyle,
        }, {
          sanskritFontPreset,
        });

        return script === 'tamil' ? getScriptDisplayText('tamil', formatted) : formatted;
      };

      if (!activeWordRange) {
        return formatText(sourceText);
      }

      return (
        <>
          {formatText(sourceText.slice(0, activeWordRange.start))}
          <span
            className="rounded-sm bg-yellow-100/40 px-0.5 -mx-0.5 font-bold text-[#6b1f1f]"
            data-current-word="true"
          >
            {formatText(sourceText.slice(activeWordRange.start, activeWordRange.end))}
          </span>
          {formatText(sourceText.slice(activeWordRange.end))}
        </>
      );
    },
    [romanOutputStyle, tamilOutputStyle, sanskritFontPreset]
  );

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
            ref={mirrorCaretRef}
            aria-hidden="true"
            className="inline-block h-0 w-0 overflow-hidden opacity-0 align-baseline"
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
            isCurrentWordVisible && 'text-[#6b1f1f]'
          )}
          data-source-selection={isSelectionVisible ? 'true' : undefined}
          data-current-source-word={isCurrentWordVisible ? 'true' : undefined}
        >
          {text}
        </span>
      );
    }

    if (isCollapsedSelection && clampedCaret === sourceLength) {
      fragments.push(
        <span
          key="itrans-caret-end"
          ref={mirrorCaretRef}
          aria-hidden="true"
          className="inline-block h-0 w-0 overflow-hidden opacity-0 align-baseline"
          data-testid="itrans-mirror-caret"
        />
      );
    }

    return fragments;
  })();

  const syncPaneScroll = React.useCallback(
    (source: HTMLElement, targets: (HTMLElement | null)[]) => {
      if (!syncComposerScroll) {
        return;
      }

      const sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
      const progress = sourceRange <= 0 ? 0 : source.scrollTop / sourceRange;

      targets.forEach((target) => {
        if (!target) {
          return;
        }

        const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
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

    if (isMultiLine) {
      e.preventDefault();
      let processedText = pastedText;

      if (isDevanagari) {
        processedText = canonicalizeDevanagariPaste(pastedText);
      }

      if (displaySettings.autoSwapVisargaSvarita) {
        processedText = normalizeMarkerSequences(processedText);
      }

      // Split into blocks by lines, but keep structure
      const lines = processedText.split(/\r?\n/).map(line => line.trim());
      // We only split into blocks if there's actual content to avoid creating empty blocks at end of paste
      const nonBufferLines = lines.filter(l => l.length > 0);

      if (nonBufferLines.length > 1) {
        addBlocks(nonBufferLines);
        return;
      }
      // If it was multiline but effectively one line (e.g. trailing newlines), fall through to inline
      processedText = nonBufferLines[0] || '';
    }

    if (isDevanagari) {
      e.preventDefault();
      let itransText = canonicalizeDevanagariPaste(pastedText);

      if (displaySettings.autoSwapVisargaSvarita) {
        itransText = normalizeMarkerSequences(itransText);
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
    } else {
      // For non-devanagari (ITRANS) paste, we still want to apply the swap if enabled
      if (displaySettings.autoSwapVisargaSvarita) {
        const normalized = normalizeMarkerSequences(pastedText);
        if (normalized !== pastedText) {
          e.preventDefault();
          const target = e.currentTarget;
          const selectionStart = target.selectionStart;
          const selectionEnd = target.selectionEnd;
          const currentSource = activeChunkGroup?.source || '';
          const newSource =
            currentSource.slice(0, selectionStart) +
            normalized +
            currentSource.slice(selectionEnd);
          const nextCaret = selectionStart + normalized.length;

          updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
          recordSessionLexicalText(normalized);
        }
      }
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!e.altKey && !e.ctrlKey && !e.metaKey) {
      const isInputKey = e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete';
      if (isInputKey) {
        setIsPredictionPopupSuppressed(false);
      }
    }

    if (!e.altKey && !e.ctrlKey && !e.metaKey && hasLexicalSuggestions && isPredictionListbox && isPredictionPopupVisible) {
      if (/^[1-7]$/.test(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (index < lexicalSuggestions.length) {
          e.preventDefault();
          acceptLexicalSuggestion(index);
          return;
        }
      }

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

    if (!e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Enter') {
      if (hasLexicalSuggestions) {
        if (acceptLexicalSuggestion(lexicalSelectedSuggestionIndex)) {
          e.preventDefault();
          return;
        }
      }
      
      // Shift+Enter to split the block
      if (e.shiftKey && (editorState.viewMode === 'document' || editorState.viewMode === 'read') && activeBlock) {
        e.preventDefault();
        splitBlock(activeBlock.id, composerSelectionStart);
        return;
      }

      // Standard Enter behavior (newline) - trigger hint
      if (!e.shiftKey && (editorState.viewMode === 'document' || editorState.viewMode === 'read')) {
        triggerShiftEnterHint();
      }

      // Standard Enter behavior (newline) if not splitting
      // We don't preventDefault here to allow the textarea to handle the newline naturally,
      // UNLESS it was already handled by suggestions above.
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
      }
    } else if (e.key === 'Delete') {
      if (composerSelectionStart === currentChunkSource.length && composerSelectionEnd === currentChunkSource.length && activeBlock) {
        e.preventDefault();
        mergeBlocks(activeBlock.id, 'next');
        return;
      }
      setDeletedBuffer(null);
    } else {
      setDeletedBuffer(null);
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

  const focusComposerAt = (nextCaret: number) => {
    const applySelection = () => {
      const composer = composerRef.current;
      if (!composer) {
        return;
      }

      isProgrammaticSelectionRef.current = true;
      composer.focus({ preventScroll: true });
      composer.setSelectionRange(nextCaret, nextCaret);
      setComposerSelection(nextCaret, nextCaret);
      window.requestAnimationFrame(() => {
        isProgrammaticSelectionRef.current = false;
      });
    };

    applySelection();
    requestAnimationFrame(applySelection);
  };

  const handlePreviewPointerDown = (
    event: React.MouseEvent<HTMLElement> | React.PointerEvent<HTMLElement>
  ) => {
    const wordRange = getPreviewWordRangeFromPoint(event);
    if (!wordRange) {
      event.preventDefault();
      focusComposerAt(currentChunkSource.length);
      return;
    }

    event.preventDefault();
    focusComposerAt(wordRange.caret);
  };

  const scrollAnchorIntoView = React.useCallback((container: HTMLElement | null) => {
    if (!container) return;
    
    const anchor =
      container.querySelector<HTMLElement>('[data-current-word="true"]') ??
      container.querySelector<HTMLElement>(`[data-source-start="${currentSourceWordRange?.start ?? -1}"]`) ??
      container.querySelector<HTMLElement>('[data-testid="preview-caret"]');

    if (!anchor) return;

    const containerRect = container.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const isFullyVisible =
      anchorRect.top >= containerRect.top + 8 &&
      anchorRect.bottom <= containerRect.bottom - 8;

    if (!isFullyVisible) {
      anchor.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
    }
  }, [currentSourceWordRange?.start]);

  const handleComposerScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    if (programmaticScrollTargetRef.current === event.currentTarget) {
      return;
    }

    scrollSyncSourceRef.current = 'source';
    if (composerHighlightRef.current) {
      composerHighlightRef.current.style.transform = `translateY(-${event.currentTarget.scrollTop}px)`;
    }
    syncPaneScroll(event.currentTarget, [previewRef.current, comparePreviewRef.current]);
    window.requestAnimationFrame(() => {
      scrollAnchorIntoView(previewRef.current);
      if (isComposerCompareMode) {
        scrollAnchorIntoView(comparePreviewRef.current);
      }
    });
  };

  const handlePreviewScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (programmaticScrollTargetRef.current === event.currentTarget) {
      return;
    }

    scrollSyncSourceRef.current = 'preview';
    syncPaneScroll(event.currentTarget, [composerRef.current, comparePreviewRef.current]);
  };

  const handleComparePreviewScroll = (event: React.UIEvent<HTMLDivElement>) => {
    if (programmaticScrollTargetRef.current === event.currentTarget) {
      return;
    }

    scrollSyncSourceRef.current = 'preview'; // Treating compare pane as a 'preview' source
    syncPaneScroll(event.currentTarget, [composerRef.current, previewRef.current]);
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
      syncPaneScroll(composerRef.current, [previewRef.current, comparePreviewRef.current]);
      return;
    }

    if (scrollSyncSourceRef.current === 'preview' && previewRef.current) {
      syncPaneScroll(previewRef.current, [composerRef.current, comparePreviewRef.current]);
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
      scrollAnchorIntoView(previewRef.current);
      if (isComposerCompareMode) {
        scrollAnchorIntoView(comparePreviewRef.current);
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
    scrollAnchorIntoView,
    isComposerCompareMode,
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
      const popupWidth = Math.min(512, Math.max(300, paneRect.width - 20));
      
      // Attempt to position near caret if possible
      if (mirrorCaretRef.current) {
        const caretRect = mirrorCaretRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = caretRect.left;
        let top = caretRect.bottom + 8;

        // Horizontal overflow check
        if (left + popupWidth > viewportWidth - 16) {
          left = Math.max(16, viewportWidth - popupWidth - 16);
        }

        // Vertical overflow check (if too close to bottom, show above caret)
        const estimatedPopupHeight = 220; // WordPredictionTray approx height
        if (top + estimatedPopupHeight > viewportHeight - 16) {
          top = Math.max(16, caretRect.top - estimatedPopupHeight - 8);
        }

        setPredictionPopupPortalStyle({
          left,
          top,
          width: popupWidth,
        });
      } else {
        // Fallback to pane-relative positioning if caret not found
        setPredictionPopupPortalStyle({
          left: paneRect.left + 10,
          top: paneRect.bottom + 6,
          width: popupWidth,
        });
      }
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
        tamilOutputStyle,
      }, {
        sanskritFontPreset,
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
  };

  return (
    <>
    <div className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-none flex-col gap-3 px-2 pb-2 pt-2 sm:px-4 sm:pb-3 sm:pt-3 lg:px-6">
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/70 bg-slate-50/80 px-3 py-2">
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

              <div className="flex items-center gap-2">
                <Link
                  href="/help"
                  className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-700 hover:bg-slate-100"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Help
                </Link>

                <a
                  href="https://github.com/mrgkumar/sanskrit-keyboard/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-rose-100 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-rose-700 hover:bg-rose-50"
                  title="Report an issue on GitHub"
                >
                  <Bug className="h-3.5 w-3.5 text-rose-500" />
                  Report Bug
                </a>

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
          </div>

          <div
            ref={composerSplitContainerRef}
            className={clsx(
              'grid min-h-0 flex-1 overflow-hidden rounded-[1.4rem] border border-slate-200/50 bg-white/85 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.4)]',
              isStackedComposer
                ? 'grid-cols-1 gap-2.5 p-2.5'
                : 'grid-cols-1 lg:gap-0'
            )}
            style={composerSplitGridTemplateColumns ? { gridTemplateColumns: composerSplitGridTemplateColumns } : undefined}
          >
            <div
              ref={sourcePaneRef}
              className={clsx(
                'group relative flex min-h-0 flex-col gap-3 overflow-hidden rounded-[1.15rem] border border-slate-100/70 bg-white/92 p-2.5 shadow-sm sm:p-3',
                isStackedComposer ? 'flex-auto min-h-[12rem]' : 'flex-1 min-h-0'
              )}
            >
              <div className="flex items-start justify-between gap-3 px-1">
                <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">ITRANS Input</p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        Type in ITRANS here. The live preview mirrors the active chunk.
                      </p>
                    </div>
                    {showShiftEnterHint && (
                      <div className="flex animate-in fade-in slide-in-from-left-2 duration-300 items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm ring-1 ring-blue-500/50">
                        <div className="h-1 w-1 animate-pulse rounded-full bg-blue-200" />
                        Tip: Shift+Enter to split block
                      </div>
                    )}
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
                className="relative flex-none overflow-hidden rounded-[1rem] border border-slate-200/40 bg-white/98 shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)]"
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
                    className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1rem] py-2.5 pl-3 pr-7 font-mono text-lg text-slate-900 md:pr-8"
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
                      className="relative z-10 h-full w-full overflow-y-auto rounded-[1rem] bg-transparent py-2.5 pl-3 pr-7 font-mono text-lg text-transparent caret-slate-900 outline-none selection:bg-blue-200/80 selection:text-transparent placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 md:pr-8"
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
                        if (!isPointerSelectingRef.current && !isProgrammaticSelectionRef.current) {
                          syncSelection(e.currentTarget);
                        }
                      }}
                      rows={6}
                      placeholder="... start typing or paste devanagari text."
                    />
                  </div>
                </div>
                <ResizeHandle
                  size={composerInputHeight}
                  minSize={140}
                  maxSize={360}
                  ariaLabel="Resize ITRANS input height"
                  onSizeChange={updateComposerInputHeight}
                  placement="corner"
                  axis="y"
                />
              </div>
              {predictionLayout === 'inline' && <WordPredictionTray variant="inline" />}
              {predictionLayout === 'split' && <WordPredictionTray variant="split" />}
            </div>

            {!isStackedComposer && (
              <ResizeHandle
                size={composerSourcePaneWidth}
                minSize={composerSplitMinPaneWidth}
                maxSize={composerSplitMaxSourceWidth}
                ariaLabel="Resize composer width"
                onSizeChange={updateComposerSplitWidth}
                axis="x"
                className="hidden lg:flex"
              />
            )}

            <div
              className={clsx(
                'group flex min-h-0 flex-col gap-3 overflow-hidden rounded-[1.15rem] border border-slate-100/70 bg-white/92 p-2.5 text-blue-800 shadow-sm sm:p-3',
                isStackedComposer ? 'flex-auto border-slate-200/70' : 'flex-1 lg:border-l-0 lg:border-t-0 lg:rounded-l-none'
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
                className="relative flex-none overflow-hidden rounded-[1rem] border border-slate-200/40 bg-white/98 shadow-[0_6px_16px_-10px_rgba(15,23,42,0.35)]"
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
                    className="overflow-y-auto rounded-[1rem] bg-white/70 px-2.5 pb-2.5 pt-2 shadow-none sm:px-3 sm:pb-3 sm:pt-2.5"
                    data-testid="sticky-preview-primary-pane"
                    onPointerDownCapture={handlePreviewPointerDown}
                    onScroll={handlePreviewScroll}
                    style={{
                      height: `${composerPrimaryPreviewHeight}px`,
                      fontSize: `${getRenderedFontSizeForScript(primaryOutputScript)}px`,
                      lineHeight: getRenderedLineHeightForScript(primaryOutputScript),
                    }}
                  >
                    {primaryOutputScript === 'devanagari' ? (
                      renderedPreviewChars.length === 0 ? (
                        'Devanagari preview'
                      ) : (
                        <div className="relative">
                          {/* Hidden mirror to position the caret */}
                          <div 
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 text-transparent opacity-0"
                          >
                            <span 
                              className="font-serif script-text-devanagari whitespace-pre-wrap break-words"
                              data-font-preset={sanskritFontPreset}
                              style={{
                                fontSize: `${composerTypography.devanagariFontSize}px`,
                                lineHeight: composerTypography.devanagariLineHeight,
                              }}
                            >
                              {renderedPreview.unicode.slice(0, targetCaretIndex)}
                              <span ref={primaryPreviewCaretRef} className="inline-block w-0" />
                            </span>
                          </div>

                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-0"
                          >
                            <span
                              className="font-serif script-text-devanagari whitespace-pre-wrap break-words text-slate-900"
                              data-font-preset={sanskritFontPreset}
                              lang="sa"
                              style={{
                                fontSize: `${composerTypography.devanagariFontSize}px`,
                                lineHeight: composerTypography.devanagariLineHeight,
                              }}
                            >
                              {renderPreviewWordSegments('devanagari', {
                                sourceText: currentChunkSource,
                                fontSize: composerTypography.devanagariFontSize,
                                lineHeight: composerTypography.devanagariLineHeight,
                                sanskritFontPreset,
                                tamilFontPreset,
                                activeWordRange: currentSourceWordRange,
                              })}
                            </span>
                          </div>

                          {/* Real text with highlighting */}
                          <span
                            className="pointer-events-none font-serif script-text-devanagari whitespace-pre-wrap break-words text-slate-900"
                            data-font-preset={sanskritFontPreset}
                            lang="sa"
                            style={{
                              fontSize: `${composerTypography.devanagariFontSize}px`,
                              lineHeight: composerTypography.devanagariLineHeight,
                            }}
                          >
                            {renderPreviewVisibleText('devanagari', currentChunkSource, currentSourceWordRange)}
                          </span>
                          
                          {/* Absolutely positioned visible caret */}
                          <CaretOverlay 
                            targetRef={primaryPreviewCaretRef} 
                            containerRef={previewRef}
                            color="bg-blue-600"
                          />
                        </div>
                      )
                    ) : primaryOutputScript === 'tamil' ? (
                      <div className="relative">
                        <div 
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 text-transparent opacity-0"
                        >
                          <span 
                            className="font-tamil-reading script-text-tamil whitespace-pre-wrap break-words"
                            data-font-preset={tamilFontPreset}
                            style={{
                              fontSize: `${composerTypography.tamilFontSize}px`,
                              lineHeight: composerTypography.tamilLineHeight,
                            }}
                          >
                            {formatSourceForScript(currentChunkSource.slice(0, composerSelectionStart), 'tamil', {
                              romanOutputStyle,
                              tamilOutputStyle,
                            }, {
                              sanskritFontPreset,
                            })}
                            <span ref={primaryPreviewCaretRef} className="inline-block w-0" />
                          </span>
                        </div>

                        <div
                          aria-hidden="true"
                          className="absolute inset-0 opacity-0"
                        >
                          <span
                            className="font-tamil-reading script-text-tamil script-text-wrap whitespace-pre-wrap text-slate-900"
                            data-font-preset={tamilFontPreset}
                            lang="ta"
                            dir="ltr"
                            style={{
                              fontSize: `${composerTypography.tamilFontSize}px`,
                              lineHeight: composerTypography.tamilLineHeight,
                            }}
                          >
                            {renderPreviewWordSegments('tamil', {
                              sourceText: currentChunkSource,
                              fontSize: composerTypography.tamilFontSize,
                              lineHeight: composerTypography.tamilLineHeight,
                              sanskritFontPreset,
                              tamilFontPreset,
                              activeWordRange: currentSourceWordRange,
                            })}
                          </span>
                        </div>
                        
                        <span
                          className="pointer-events-none font-tamil-reading script-text-tamil script-text-wrap whitespace-pre-wrap text-slate-900"
                          data-font-preset={tamilFontPreset}
                          lang="ta"
                          dir="ltr"
                          style={{
                            fontSize: `${composerTypography.tamilFontSize}px`,
                            lineHeight: composerTypography.tamilLineHeight,
                          }}
                        >
                          {renderPreviewVisibleText('tamil', currentChunkSource, currentSourceWordRange)}
                        </span>

                        <CaretOverlay 
                          targetRef={primaryPreviewCaretRef} 
                          containerRef={previewRef}
                          color="bg-blue-600"
                        />
                      </div>
                    ) : (
                      <span
                        className="font-mono script-text-wrap whitespace-pre-wrap break-words text-slate-900"
                        style={{
                          fontSize: `${composerTypography.devanagariFontSize}px`,
                          lineHeight: composerTypography.devanagariLineHeight,
                        }}
                      >
                        {renderPreviewWordSegments('roman', {
                          sourceText: currentChunkSource,
                          fontSize: composerTypography.devanagariFontSize,
                          lineHeight: composerTypography.devanagariLineHeight,
                          sanskritFontPreset,
                          tamilFontPreset,
                          activeWordRange: currentSourceWordRange,
                        })}
                      </span>
                    )}
                  </div>
                  <ResizeHandle
                    size={composerPrimaryPreviewHeight}
                    minSize={previewMinHeight}
                    maxSize={isComposerCompareMode ? previewSplitMaxHeight : 360}
                    ariaLabel={isComposerCompareMode ? 'Resize compare split' : 'Resize primary preview height'}
                    onSizeChange={updateComposerPreviewSplitHeight}
                    axis="y"
                  />

                  {isComposerCompareMode && (
                    <div
                      ref={comparePreviewRef}
                      className="relative overflow-y-auto rounded-[1rem] bg-slate-50/85 px-2.5 pb-2.5 pt-2 text-slate-700 shadow-none sm:px-3 sm:pb-3 sm:pt-2.5"
                      data-testid="sticky-preview-compare-pane"
                      onPointerDownCapture={handlePreviewPointerDown}
                      onScroll={handleComparePreviewScroll}
                      style={{
                        height: `${composerComparePreviewHeight}px`,
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
                      <div className="relative">
                        {/* Hidden mirror to position the caret */}
                        <div 
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 text-transparent opacity-0"
                        >
                          <span 
                            className={clsx(
                              (activeComparisonScript ?? primaryOutputScript) === 'devanagari' ? 'font-serif script-text-devanagari' : 
                              (activeComparisonScript ?? primaryOutputScript) === 'tamil' ? 'font-tamil-reading script-text-tamil' : 'font-mono',
                              'whitespace-pre-wrap break-words'
                            )}
                            data-font-preset={(activeComparisonScript ?? primaryOutputScript) === 'tamil' ? tamilFontPreset : sanskritFontPreset}
                            style={{
                              fontSize: `${Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14)}px`,
                              lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                            }}
                          >
                            {(activeComparisonScript ?? primaryOutputScript) === 'devanagari' ? (
                              renderedPreview.unicode.slice(0, targetCaretIndex)
                            ) : (activeComparisonScript ?? primaryOutputScript) === 'tamil' ? (
                              formatSourceForScript(currentChunkSource.slice(0, composerSelectionStart), 'tamil', {
                                romanOutputStyle,
                                tamilOutputStyle,
                              }, {
                                sanskritFontPreset,
                              })
                            ) : (
                              comparisonPreviewText.slice(0, composerSelectionStart)
                            )}
                            <span ref={comparisonPreviewCaretRef} className="inline-block w-0" />
                          </span>
                        </div>

                        {(activeComparisonScript ?? primaryOutputScript) === 'tamil' && (
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-0"
                          >
                            <span
                              className="font-tamil-reading script-text-tamil whitespace-pre-wrap break-words text-slate-700"
                              data-font-preset={tamilFontPreset}
                              lang="ta"
                              dir="ltr"
                              style={{
                                fontSize: `${Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14)}px`,
                                lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                              }}
                            >
                              {renderPreviewWordSegments('tamil', {
                                sourceText: currentChunkSource,
                                fontSize: Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14),
                                lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                                sanskritFontPreset,
                                tamilFontPreset,
                                activeWordRange: currentSourceWordRange,
                              })}
                            </span>
                          </div>
                        )}

                        {(activeComparisonScript ?? primaryOutputScript) === 'devanagari' && (
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 opacity-0"
                          >
                            <span
                              className="font-serif script-text-devanagari whitespace-pre-wrap break-words text-slate-700"
                              data-font-preset={sanskritFontPreset}
                              lang="sa"
                              style={{
                                fontSize: `${Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14)}px`,
                                lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                              }}
                            >
                              {renderPreviewWordSegments('devanagari', {
                                sourceText: currentChunkSource,
                                fontSize: Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14),
                                lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                                sanskritFontPreset,
                                tamilFontPreset,
                                activeWordRange: currentSourceWordRange,
                              })}
                            </span>
                          </div>
                        )}

                        {/* Real text as a single node for perfect ligatures */}
                        <span
                          className={clsx(
                            (activeComparisonScript ?? primaryOutputScript) === 'devanagari' ? 'font-serif script-text-devanagari pointer-events-none' : 
                            (activeComparisonScript ?? primaryOutputScript) === 'tamil' ? 'font-tamil-reading script-text-tamil pointer-events-none' : 'font-mono',
                            'whitespace-pre-wrap break-words text-slate-700'
                          )}
                          data-font-preset={(activeComparisonScript ?? primaryOutputScript) === 'tamil' ? tamilFontPreset : sanskritFontPreset}
                          lang={(activeComparisonScript ?? primaryOutputScript) === 'devanagari' ? 'sa' : (activeComparisonScript ?? primaryOutputScript) === 'tamil' ? 'ta' : undefined}
                          dir={(activeComparisonScript ?? primaryOutputScript) === 'tamil' ? 'ltr' : undefined}
                          style={{
                            fontSize: `${Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14)}px`,
                            lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                          }}
                        >
                          {(activeComparisonScript ?? primaryOutputScript) === 'tamil'
                            ? renderPreviewVisibleText('tamil', currentChunkSource, currentSourceWordRange)
                            : (activeComparisonScript ?? primaryOutputScript) === 'devanagari'
                              ? renderPreviewVisibleText('devanagari', currentChunkSource, currentSourceWordRange)
                              : renderPreviewWordSegments(activeComparisonScript ?? primaryOutputScript, {
                                sourceText: currentChunkSource,
                                fontSize: Math.max(getRenderedFontSizeForScript(activeComparisonScript ?? primaryOutputScript) - 2, 14),
                                lineHeight: getRenderedLineHeightForScript(activeComparisonScript ?? primaryOutputScript),
                                sanskritFontPreset,
                                tamilFontPreset,
                                activeWordRange: currentSourceWordRange,
                              })}
                        </span>

                        {/* Absolutely positioned visible caret */}
                        <CaretOverlay 
                          targetRef={comparisonPreviewCaretRef} 
                          containerRef={comparePreviewRef}
                          color="bg-slate-400"
                        />
                      </div>

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
    <StickyTopComposerPredictionPopup
      isPredictionListbox={isPredictionListbox}
      isPredictionPopupVisible={isPredictionPopupVisible}
      predictionPopupPortalStyle={predictionPopupPortalStyle}
      onSuggestionAccepted={() => {
        setIsPredictionPopupVisible(false);
        setIsPredictionPopupSuppressed(true);
      }}
    />
    </>
  );
};
