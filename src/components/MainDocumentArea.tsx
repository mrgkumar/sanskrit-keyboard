// app/src/components/MainDocumentArea.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { AnnotationColor, CanonicalBlock, DocumentAnnotation } from '@/store/types';
import { clsx } from 'clsx';
import { Bookmark, Check, ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Highlighter, Search, Trash2, X } from 'lucide-react';
import { formatSourceForScript, transliterate } from '@/lib/vedic/utils';
import { ScriptText } from '@/components/ScriptText';
import { ResizeHandle } from '@/components/VerticalResizeHandle';

export const MainDocumentArea: React.FC = () => {
  const {
    blocks,
    editorState,
    setActiveBlockId,
    activateBlockChunk,
    deleteBlock,
    getActiveChunkGroup,
    displaySettings,
    setViewMode,
    setComposerSelection,
    setTypography,
    annotations,
    showAnnotationOverlay,
    isAnnotationNavigatorOpen,
    annotationEditWarning,
    upsertAnnotation,
    removeAnnotation,
    setShowAnnotationOverlay,
    setAnnotationNavigatorOpen,
    dismissAnnotationEditWarning,
    immersiveFindOpen,
    immersiveFindQuery,
    immersiveFindActiveMatchIndex,
    setImmersiveFindOpen,
    setImmersiveFindQuery,
    setImmersiveFindActiveMatchIndex,
  } = useFlowStore();
  const { activeBlockId, viewMode, focusSpan } = editorState;
  const activeChunkGroup = getActiveChunkGroup(); 
  const {
    typography,
    primaryOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
    sanskritFontPreset,
    tamilFontPreset,
    showItransInDocument,
  } = displaySettings;
  const documentTypography = typography.document;
  const immersiveTypography = typography.immersive;
  const readModeScrollMarginTop = '56vh';
  
  const updateDocumentHeight = React.useCallback(
    (key: 'primaryPaneHeight' | 'comparePaneHeight') => (nextHeight: number) => {
      setTypography('document', { [key]: nextHeight } as Partial<typeof documentTypography>);
    },
    [setTypography]
  );
  
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [selectedReadBlockId, setSelectedReadBlockId] = React.useState<string | null>(null);
  const [annotationTarget, setAnnotationTarget] = React.useState<{
    blockId: string;
    startOffset: number;
    endOffset: number;
    sourceText: string;
    displayText: string;
    left: number;
    top: number;
  } | null>(null);
  
  const documentContainerRef = React.useRef<HTMLDivElement | null>(null);
  const primaryPaneScrollRef = React.useRef<HTMLDivElement | null>(null);
  const immersiveFindInputRef = React.useRef<HTMLInputElement | null>(null);
  
  const readModeBlocks = React.useMemo(
    () => blocks.filter((block) => block.rendered.trim().length > 0),
    [blocks]
  );

  const normalizeFindText = React.useCallback((text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim(), []);

  const immersiveFindPreviewText = React.useMemo(() => {
    if (!immersiveFindQuery.trim()) return '';
    return formatSourceForScript(
      immersiveFindQuery,
      primaryOutputScript,
      {
        romanOutputStyle,
        tamilOutputStyle,
      },
      {
        sanskritFontPreset,
      }
    );
  }, [immersiveFindQuery, primaryOutputScript, romanOutputStyle, tamilOutputStyle, sanskritFontPreset]);

  type FindWordSpan = {
    wordKey: string;
    start: number;
    end: number;
    sourceText: string;
    renderedText: string;
  };

  type ImmersiveFindMatch = {
    blockId: string;
    startWordIndex: number;
    endWordIndex: number;
    wordKeys: string[];
    firstWordKey: string;
  };

  const blockWordSpans = React.useMemo(
    () =>
      blocks.map((block) => {
        const words: FindWordSpan[] = [];
        for (const match of block.source.matchAll(/\S+/g)) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          const sourceText = block.source.slice(start, end);
          words.push({
            wordKey: `${block.id}:${start}:${end}`,
            start,
            end,
            sourceText,
            renderedText: formatSourceForScript(
              sourceText,
              primaryOutputScript,
              {
                romanOutputStyle,
                tamilOutputStyle,
              },
              {
                sanskritFontPreset,
              }
            ),
          });
        }
        return {
          blockId: block.id,
          words,
        };
      }),
    [blocks, primaryOutputScript, romanOutputStyle, sanskritFontPreset, tamilOutputStyle]
  );

  const immersiveFindMatches = React.useMemo<ImmersiveFindMatch[]>(() => {
    if (!immersiveFindOpen) return [];
    const queryTokens = normalizeFindText(immersiveFindPreviewText).split(' ').filter(Boolean);
    if (queryTokens.length === 0) return [];

    const matches: ImmersiveFindMatch[] = [];
    for (const block of blockWordSpans) {
      const words = block.words;
      if (words.length === 0) continue;

      for (let startWordIndex = 0; startWordIndex < words.length; startWordIndex += 1) {
        let matched = true;
        for (let tokenIndex = 0; tokenIndex < queryTokens.length; tokenIndex += 1) {
          const word = words[startWordIndex + tokenIndex];
          if (!word) {
            matched = false;
            break;
          }

          const wordText = normalizeFindText(word.renderedText);
          if (!wordText.includes(queryTokens[tokenIndex])) {
            matched = false;
            break;
          }
        }

        if (!matched) continue;

        const matchedWords = words.slice(startWordIndex, startWordIndex + queryTokens.length);
        matches.push({
          blockId: block.blockId,
          startWordIndex,
          endWordIndex: startWordIndex + matchedWords.length - 1,
          wordKeys: matchedWords.map((word) => word.wordKey),
          firstWordKey: matchedWords[0]?.wordKey ?? words[startWordIndex].wordKey,
        });
      }
    }

    return matches;
  }, [blockWordSpans, immersiveFindOpen, immersiveFindPreviewText, normalizeFindText]);

  const activeImmersiveFindMatch = immersiveFindMatches[immersiveFindActiveMatchIndex] ?? null;
  const immersiveFindMatchWordKeys = React.useMemo(
    () => new Set(immersiveFindMatches.flatMap((match) => match.wordKeys)),
    [immersiveFindMatches]
  );
  const activeImmersiveFindWordKeys = React.useMemo(
    () => new Set(activeImmersiveFindMatch?.wordKeys ?? []),
    [activeImmersiveFindMatch]
  );

  const getRenderedLineHeightForScript = React.useCallback(
    (script: typeof primaryOutputScript) =>
      script === 'tamil'
        ? documentTypography.tamilLineHeight
        : documentTypography.devanagariLineHeight,
    [documentTypography.devanagariLineHeight, documentTypography.tamilLineHeight]
  );

  const getRenderedFontSizeForScript = React.useCallback(
    (script: typeof primaryOutputScript) =>
      script === 'tamil'
        ? documentTypography.tamilFontSize
        : documentTypography.devanagariFontSize,
    [documentTypography.devanagariFontSize, documentTypography.tamilFontSize]
  );

  const blockOrder = React.useMemo(
    () => new Map(blocks.map((block, index) => [block.id, index])),
    [blocks]
  );

  const sortedAnnotations = React.useMemo(
    () =>
      [...annotations].sort((left, right) => {
        const leftBlock = blockOrder.get(left.blockId) ?? Number.MAX_SAFE_INTEGER;
        const rightBlock = blockOrder.get(right.blockId) ?? Number.MAX_SAFE_INTEGER;
        if (leftBlock !== rightBlock) {
          return leftBlock - rightBlock;
        }
        return left.startOffset - right.startOffset || left.endOffset - right.endOffset;
      }),
    [annotations, blockOrder]
  );

  React.useEffect(() => {
    if (!copiedId) return;
    const timeoutId = window.setTimeout(() => setCopiedId(null), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [copiedId]);

  React.useEffect(() => {
    if (viewMode !== 'review' || !activeBlockId) return;
    const scrollActiveTargetIntoView = () => {
      const container = documentContainerRef.current;
      if (!container) return;
      const target = (activeChunkGroup
          ? container.querySelector<HTMLElement>(
              `[data-testid="document-review-segment-${activeChunkGroup.blockId}-${activeChunkGroup.startSegmentIndex}"]`
            )
          : null) ??
        container.querySelector<HTMLElement>(`[data-testid="document-review-block-${activeBlockId}"]`);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    };
    const rafId = window.requestAnimationFrame(scrollActiveTargetIntoView);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeBlockId, activeChunkGroup, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'read' && viewMode !== 'immersive') return;
    setSelectedReadBlockId((current) => {
      if (current && readModeBlocks.some((block) => block.id === current)) return current;
      return activeBlockId ?? readModeBlocks[0]?.id ?? null;
    });
  }, [activeBlockId, readModeBlocks, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'read' && viewMode !== 'immersive') return;
    const rafId = window.requestAnimationFrame(() => {
      documentContainerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'immersive') setAnnotationTarget(null);
  }, [viewMode]);

  React.useEffect(() => {
    if (viewMode === 'immersive') return;
    if (immersiveFindOpen) {
      setImmersiveFindOpen(false);
    }
  }, [immersiveFindOpen, setImmersiveFindOpen, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'immersive' || !immersiveFindOpen) return;
    const rafId = window.requestAnimationFrame(() => {
      immersiveFindInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [immersiveFindOpen, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'immersive') return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const isFindShortcut = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f';
      if (isFindShortcut) {
        event.preventDefault();
        event.stopPropagation();
        setImmersiveFindOpen(true);
        window.requestAnimationFrame(() => {
          immersiveFindInputRef.current?.focus({ preventScroll: true });
        });
        return;
      }

      if (event.key === 'Escape' && immersiveFindOpen) {
        const target = event.target as HTMLElement | null;
        const isTypingSurface =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable;
        if (isTypingSurface || immersiveFindOpen) {
          event.preventDefault();
          event.stopPropagation();
          setImmersiveFindOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [immersiveFindOpen, setImmersiveFindOpen, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'immersive' || !immersiveFindOpen) return;
    if (immersiveFindMatches.length === 0) {
      if (immersiveFindActiveMatchIndex !== 0) {
        setImmersiveFindActiveMatchIndex(0);
      }
      return;
    }

    if (immersiveFindActiveMatchIndex >= immersiveFindMatches.length) {
      setImmersiveFindActiveMatchIndex(0);
    }
  }, [
    immersiveFindActiveMatchIndex,
    immersiveFindMatches.length,
    immersiveFindOpen,
    setImmersiveFindActiveMatchIndex,
    viewMode,
  ]);

  React.useEffect(() => {
    if (viewMode !== 'immersive' || !immersiveFindOpen || immersiveFindMatches.length === 0) return;
    const activeMatch = immersiveFindMatches[
      Math.max(0, Math.min(immersiveFindActiveMatchIndex, immersiveFindMatches.length - 1))
    ];
    const target = documentContainerRef.current?.querySelector<HTMLElement>(
      `[data-immersive-find-word-key="${CSS.escape(activeMatch.firstWordKey)}"]`
    );
    target?.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, [immersiveFindActiveMatchIndex, immersiveFindMatches, immersiveFindOpen, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'document' || !activeBlockId) return;
    const scrollActiveDocumentBlockIntoView = () => {
      const container = documentContainerRef.current;
      if (!container) return;
      const target = container.querySelector<HTMLElement>(`[data-testid="document-canvas-block-${activeBlockId}"]`);
      if (!target) return;
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
    };
    const rafId = window.requestAnimationFrame(scrollActiveDocumentBlockIntoView);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeBlockId, viewMode]);

  const handleCopyBlock = async (blockId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(blockId);
    } catch {
      setCopiedId(`error:${blockId}`);
    }
  };

  const handleCopyWord = async (wordKey: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(wordKey);
    } catch {
      setCopiedId(`error:${wordKey}`);
    }
  };

  const findAnnotationsForWord = React.useCallback(
    (blockId: string, startOffset: number, endOffset: number) =>
      annotations.filter(
        (annotation) =>
          annotation.blockId === blockId &&
          annotation.startOffset === startOffset &&
          annotation.endOffset === endOffset
      ),
    [annotations]
  );

  const getWordAnnotationClassName = React.useCallback(
    (wordAnnotations: DocumentAnnotation[]) => {
      if (viewMode !== 'immersive' || !showAnnotationOverlay || wordAnnotations.length === 0) return undefined;
      const highlight = wordAnnotations.find((annotation) => annotation.kind === 'highlight' && annotation.color === 'red') ??
        wordAnnotations.find((annotation) => annotation.kind === 'highlight');
      const hasBookmark = wordAnnotations.some((annotation) => annotation.kind === 'bookmark');
      return clsx(
        'rounded-sm px-0.5',
        highlight?.color === 'red' && 'bg-red-200/75 text-red-950 ring-1 ring-red-300/70',
        highlight?.color === 'yellow' && 'bg-yellow-200/85 text-yellow-950 ring-1 ring-yellow-300/80',
        hasBookmark && 'font-bold'
      );
    },
    [showAnnotationOverlay, viewMode]
  );

  const applyAnnotationToTarget = (kind: 'highlight' | 'bookmark', color?: AnnotationColor) => {
    if (!annotationTarget) return;
    upsertAnnotation({
      blockId: annotationTarget.blockId,
      startOffset: annotationTarget.startOffset,
      endOffset: annotationTarget.endOffset,
      sourceText: annotationTarget.sourceText,
      kind,
      color,
    });
    setAnnotationTarget(null);
    setAnnotationNavigatorOpen(true);
    documentContainerRef.current?.focus();
  };

  const scrollToAnnotation = React.useCallback((annotation: DocumentAnnotation) => {
    setSelectedReadBlockId(annotation.blockId);
    const wordKey = `${annotation.blockId}:${annotation.startOffset}:${annotation.endOffset}`;
    const target = documentContainerRef.current?.querySelector<HTMLElement>(
      `[data-word-key="${CSS.escape(wordKey)}"]`
    );
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  }, []);

  const navigateAnnotation = (direction: 1 | -1) => {
    if (sortedAnnotations.length === 0) return;
    const currentIndex = Math.max(
      0,
      sortedAnnotations.findIndex((annotation) => annotation.blockId === selectedReadBlockId)
    );
    const nextIndex = (currentIndex + direction + sortedAnnotations.length) % sortedAnnotations.length;
    scrollToAnnotation(sortedAnnotations[nextIndex]);
  };

  const getAnnotationPreviewWords = (annotation: DocumentAnnotation) => {
    const block = blocks.find((item) => item.id === annotation.blockId);
    const context = block?.source.slice(annotation.startOffset).trim() || annotation.sourceText;
    return context.split(/\s+/).slice(0, 2).join(' ');
  };

  const getAnnotationPreviewDisplayText = (annotation: DocumentAnnotation) =>
    formatSourceForScript(getAnnotationPreviewWords(annotation), primaryOutputScript, {
      romanOutputStyle,
      tamilOutputStyle,
    }, {
      sanskritFontPreset,
    });

  const activateBlock = (blockId: string) => setActiveBlockId(blockId);
  const activateChunk = (blockId: string, segmentIndex: number) => activateBlockChunk(blockId, segmentIndex);
  const selectReadLine = (blockId: string) => {
    setSelectedReadBlockId(blockId);
    documentContainerRef.current?.focus({ preventScroll: true });
  };

  const moveReadLineSelection = (direction: 1 | -1) => {
    if (readModeBlocks.length === 0) return;
    const currentIndex = Math.max(
      0,
      readModeBlocks.findIndex((block) => block.id === selectedReadBlockId)
    );
    const nextIndex = Math.max(0, Math.min(readModeBlocks.length - 1, currentIndex + direction));
    const nextBlock = readModeBlocks[nextIndex];
    if (nextBlock) {
      setSelectedReadBlockId(nextBlock.id);
      const target = documentContainerRef.current?.querySelector<HTMLElement>(
        `[data-testid="document-read-block-${nextBlock.id}"], [data-testid="document-immersive-block-${nextBlock.id}"]`
      );
      target?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  };

  const handleReadModeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (viewMode !== 'read' && viewMode !== 'immersive') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveReadLineSelection(1);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveReadLineSelection(-1);
    }
  };

  const getSourceHitFromPointer = (event: React.MouseEvent<HTMLElement>) => {
    const eventTarget = event.target instanceof HTMLElement ? event.target : null;
    const target =
      eventTarget?.closest<HTMLElement>('[data-source-start]') ??
      Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-source-start]')).find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });
    if (!target) return null;
    const sourceStart = Number(target.dataset.sourceStart);
    const sourceEnd = Number(target.dataset.sourceEnd);
    if (Number.isNaN(sourceStart) || Number.isNaN(sourceEnd)) return null;
    const rect = target.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
    const caret = Math.round(sourceStart + (sourceEnd - sourceStart) * ratio);
    return {
      start: sourceStart,
      end: sourceEnd,
      caret: Math.max(sourceStart, Math.min(sourceEnd, caret)),
    };
  };

  const handleReadBlockClick = (block: CanonicalBlock, event: React.MouseEvent<HTMLElement>) => {
    selectReadLine(block.id);
    const viewportTopBeforeEdit = event.currentTarget.getBoundingClientRect().top;
    const restoreScrollAfterEdit = () => {
      const restore = () => {
        const target = document.querySelector<HTMLElement>(`[data-testid="document-read-block-${block.id}"]`);
        if (!target) return;
        const delta = target.getBoundingClientRect().top - viewportTopBeforeEdit;
        if (Math.abs(delta) > 1) window.scrollBy(0, delta);
      };
      window.requestAnimationFrame(() => window.requestAnimationFrame(restore));
      window.setTimeout(restore, 0);
      window.setTimeout(restore, 80);
      window.setTimeout(restore, 200);
      window.setTimeout(restore, 500);
    };
    const sourceHit = getSourceHitFromPointer(event);
    if (!sourceHit) {
      jumpToEditPosition(block, 0);
      restoreScrollAfterEdit();
      return;
    }
    jumpToEditPosition(block, sourceHit.caret);
    restoreScrollAfterEdit();
  };

  const jumpToEditPosition = (block: CanonicalBlock, sourceOffset: number) => {
    const clampedSourceOffset = Math.max(0, Math.min(sourceOffset, block.source.length));
    let targetSegmentIndex = 0;
    let chunkStartOffset = 0;
    if (block.type === 'long' && block.segments?.length) {
      const matchedSegmentIndex = block.segments.findIndex((segment, index) => {
        const isLast = index === block.segments!.length - 1;
        return clampedSourceOffset >= segment.startOffset && (clampedSourceOffset < segment.endOffset || isLast);
      });
      targetSegmentIndex = Math.max(0, matchedSegmentIndex);
      const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[focusSpan];
      const startSegmentIndex = Math.floor(targetSegmentIndex / segmentsPerGroup) * segmentsPerGroup;
      chunkStartOffset = block.segments[startSegmentIndex]?.startOffset ?? 0;
    }
    activateChunk(block.id, targetSegmentIndex);
    setViewMode('review');
    const chunkLocalOffset = Math.max(0, clampedSourceOffset - chunkStartOffset);
    const applyComposerSelection = (attempt: number) => {
      const composer = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement | null;
      if (composer) {
        composer.focus({ preventScroll: true });
        composer.setSelectionRange(chunkLocalOffset, chunkLocalOffset);
        window.requestAnimationFrame(() => setComposerSelection(chunkLocalOffset, chunkLocalOffset));
        return;
      }
      if (attempt < 8) window.setTimeout(() => applyComposerSelection(attempt + 1), 40);
    };
    window.setTimeout(() => applyComposerSelection(0), 0);
  };

  const handleImmersiveBlockClick = (block: CanonicalBlock) => selectReadLine(block.id);
  const handleImmersiveBlockDoubleClick = (block: CanonicalBlock) => {
    selectReadLine(block.id);
    setViewMode('read');
  };

  const renderInteractiveSourceText = (
    block: CanonicalBlock,
    paneRole: 'primary' | 'compare' | 'document',
    sourceText: string,
    script: typeof primaryOutputScript,
    textStyle: React.CSSProperties,
  ) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    const sourceToTargetMap = script === 'devanagari' ? transliterate(sourceText).sourceToTargetMap : null;
    for (const match of sourceText.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (cursor < start) nodes.push(sourceText.slice(cursor, start));
      const sourceSlice = sourceText.slice(start, end);
      const formattedSlice = formatSourceForScript(sourceSlice, script, {
        romanOutputStyle,
        tamilOutputStyle,
      }, {
        sanskritFontPreset,
      });
      const wordKey = `${block.id}:${start}:${end}`;
      const wordAnnotations = findAnnotationsForWord(block.id, start, end);
      const isImmersiveFindMatch = viewMode === 'immersive' && immersiveFindMatchWordKeys.has(wordKey);
      const isActiveImmersiveFindWord = viewMode === 'immersive' && activeImmersiveFindWordKeys.has(wordKey);
      const handleReadWordMouseDown =
        viewMode === 'read' && paneRole === 'primary'
          ? (event: React.MouseEvent<HTMLSpanElement>) => {
              event.preventDefault();
              event.stopPropagation();
              selectReadLine(block.id);
              const blockElement = event.currentTarget.closest<HTMLElement>('[data-testid^="document-read-block-"]');
              const viewportTopBeforeEdit = blockElement?.getBoundingClientRect().top ?? null;
              const rect = event.currentTarget.getBoundingClientRect();
              const ratio = rect.width > 0 ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0;
              const caret = Math.round(start + (end - start) * ratio);
              jumpToEditPosition(block, Math.max(start, Math.min(end, caret)));
              const restore = () => {
                if (viewportTopBeforeEdit === null) return;
                const target = document.querySelector<HTMLElement>(`[data-testid="document-read-block-${block.id}"]`);
                if (!target) return;
                const delta = target.getBoundingClientRect().top - viewportTopBeforeEdit;
                if (Math.abs(delta) > 1) window.scrollBy(0, delta);
              };
              window.setTimeout(restore, 0);
              window.setTimeout(restore, 80);
              window.setTimeout(restore, 200);
              window.setTimeout(restore, 500);
            }
          : undefined;
      nodes.push(
        <span
          key={`${block.id}-${paneRole}-${start}-${end}`}
          data-source-start={start}
          data-source-end={end}
          data-target-index={sourceToTargetMap?.[start] ?? start}
          data-word-key={wordKey}
          data-immersive-find-word-key={viewMode === 'immersive' ? wordKey : undefined}
          tabIndex={viewMode === 'immersive' && paneRole === 'primary' ? 0 : undefined}
          className={clsx(
            'inline transition-colors',
            viewMode === 'immersive' && paneRole === 'primary' && 'cursor-pointer hover:bg-blue-100/70',
            isImmersiveFindMatch && 'rounded-[0.2rem] bg-amber-200/70 text-slate-950',
            isActiveImmersiveFindWord && 'ring-2 ring-amber-500/70 bg-amber-300/80',
            getWordAnnotationClassName(wordAnnotations)
          )}
          onMouseDown={handleReadWordMouseDown}
          onClick={
            viewMode === 'immersive' && paneRole === 'primary'
              ? (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  selectReadLine(block.id);
                  if (event.ctrlKey || event.metaKey) {
                    void handleCopyWord(`word:${wordKey}`, formattedSlice);
                    setAnnotationTarget(null);
                    return;
                  }
                  setAnnotationTarget({
                    blockId: block.id,
                    startOffset: start,
                    endOffset: end,
                    sourceText: sourceSlice,
                    displayText: formattedSlice,
                    left: event.clientX,
                    top: event.clientY,
                  });
                }
              : undefined
          }
        >
          <ScriptText
            script={script}
            text={formattedSlice}
            sanskritFontPreset={sanskritFontPreset}
            tamilFontPreset={tamilFontPreset}
            style={textStyle}
          />
        </span>
      );
      cursor = end;
    }
    if (cursor < sourceText.length) nodes.push(sourceText.slice(cursor));
    return nodes;
  };

  const renderInteractiveItransText = (blockKey: string, sourceText: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    for (const match of sourceText.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (cursor < start) nodes.push(sourceText.slice(cursor, start));
      nodes.push(
        <span
          key={`${blockKey}-itrans-${start}-${end}`}
          data-source-start={start}
          data-source-end={end}
          className="inline"
        >
          {sourceText.slice(start, end)}
        </span>
      );
      cursor = end;
    }
    if (cursor < sourceText.length) nodes.push(sourceText.slice(cursor));
    return nodes;
  };

  const renderScriptBlock = (
    block: CanonicalBlock,
    script: typeof primaryOutputScript,
    paneRole: 'primary' | 'compare',
    viewTestIdPrefix: 'document-read' | 'document-immersive',
    lineNumber?: number,
  ) => {
    const isSelectedReadLine =
      (viewMode === 'read' || viewMode === 'immersive') && selectedReadBlockId === block.id;
    const isComparePane = paneRole === 'compare';
    const isPrimaryPane = paneRole === 'primary';
    const isImmersive = viewMode === 'immersive';
    const wrapperClassName = clsx(
      'group relative grid items-start gap-3 rounded-md px-1 py-1 transition-colors',
      (viewMode === 'read' || viewMode === 'immersive') && 'hover:bg-slate-50',
      isSelectedReadLine && 'bg-blue-50/80 ring-1 ring-blue-200'
    );
    const lineGuide = lineNumber !== undefined ? (
      <span
        aria-hidden="true"
        className="pointer-events-none mt-0.5 inline-flex h-6 min-w-6 select-none items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500"
      >
        {lineNumber}
      </span>
    ) : null;

    if (script === 'devanagari') {
      return (
        <div
          key={`${block.id}-${paneRole}`}
          className={wrapperClassName}
          style={{
            ...(lineNumber !== undefined ? { gridTemplateColumns: '2.5rem minmax(0, 1fr)' } : undefined),
            scrollMarginTop: (viewMode === 'read' || viewMode === 'immersive') && isPrimaryPane
              ? readModeScrollMarginTop
              : undefined,
          }}
        >
          {lineGuide}
          <div
            data-testid={
              paneRole === 'primary'
                ? `${viewTestIdPrefix}-block-${block.id}`
                : `${viewTestIdPrefix}-compare-block-${block.id}`
            }
            className={clsx(
              'rounded-md px-1 py-1 transition-colors',
              paneRole === 'compare' && 'text-slate-700'
            )}
            data-selected-read-line={isSelectedReadLine ? 'true' : undefined}
            title={
              isComparePane
                ? 'Reference view'
                : isImmersive
                  ? 'Click to select, double click to open read mode'
                  : 'Click to jump back into edit mode for this block'
            }
            onClick={
              isPrimaryPane
                ? isImmersive
                  ? () => handleImmersiveBlockClick(block)
                  : (event) => handleReadBlockClick(block, event)
                : undefined
            }
            onDoubleClick={
              isPrimaryPane && isImmersive
                ? (event) => {
                    event.preventDefault();
                    handleImmersiveBlockDoubleClick(block);
                  }
                : undefined
            }
          >
            {renderInteractiveSourceText(
              block,
              paneRole,
              block.source,
              script,
              {
                fontSize: `${script === 'devanagari' && isImmersive ? immersiveTypography.devanagariFontSize : getRenderedFontSizeForScript(script)}px`,
                lineHeight: script === 'devanagari' && isImmersive ? immersiveTypography.devanagariLineHeight : getRenderedLineHeightForScript(script),
              }
            )}
          </div>
        </div>
      );
    }

    const formatted = formatSourceForScript(block.source, script, {
      romanOutputStyle,
      tamilOutputStyle,
    }, {
      sanskritFontPreset,
    });

    return (
      <div
        key={`${block.id}-${script}-${paneRole}`}
        className={wrapperClassName}
        style={{
          ...(lineNumber !== undefined ? { gridTemplateColumns: '2.5rem minmax(0, 1fr)' } : undefined),
          scrollMarginTop: (viewMode === 'read' || viewMode === 'immersive') && isPrimaryPane
            ? readModeScrollMarginTop
            : undefined,
        }}
      >
        {lineGuide}
        <div className="pointer-events-none absolute right-1 top-1 z-10 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              void handleCopyBlock(block.id, formatted);
            }}
            className={clsx(
              'pointer-events-auto rounded-md border p-1 shadow-sm',
              copiedId === block.id
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-white/90 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-200'
            )}
            type="button"
            aria-label="Copy block text"
            title={copiedId === block.id ? 'Copied' : 'Copy block'}
          >
            {copiedId === block.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
        <p
          data-testid={`${viewTestIdPrefix}-${paneRole}-block-${block.id}`}
          className="cursor-text rounded-md px-1 py-1 transition-colors whitespace-pre-wrap break-words"
          data-selected-read-line={
            (viewMode === 'read' || viewMode === 'immersive') && selectedReadBlockId === block.id
              ? 'true'
              : undefined
          }
          style={{
            fontSize: `${getRenderedFontSizeForScript(script)}px`,
            lineHeight: getRenderedLineHeightForScript(script),
          }}
          title={
            isComparePane
              ? 'Reference view'
              : isImmersive
                ? 'Click to select, double click to open read mode'
                : 'Click to jump back into edit mode for this block'
          }
            onClick={
              isPrimaryPane
                ? isImmersive
                  ? () => handleImmersiveBlockClick(block)
                  : (event) => handleReadBlockClick(block, event)
                : undefined
            }
          onDoubleClick={
            isPrimaryPane && isImmersive
              ? (event) => {
                  event.preventDefault();
                  handleImmersiveBlockDoubleClick(block);
                }
              : undefined
          }
          >
          {renderInteractiveSourceText(
            block,
            paneRole,
            block.source,
            script,
            {
              fontSize: `${getRenderedFontSizeForScript(script)}px`,
              lineHeight: getRenderedLineHeightForScript(script),
            }
          )}
        </p>
      </div>
    );
  };

  const renderBlock = (block: CanonicalBlock) => {
    const isActive = block.id === activeBlockId;
    const isLongBlock = block.type === 'long';
    const showModeSourceCard = viewMode === 'focus' ? isActive : viewMode === 'review';
    const blockClassName = clsx(
      "p-4 rounded-lg cursor-pointer transition-all",
      isActive ? "bg-blue-50 border-2 border-blue-300 shadow-md" : "hover:bg-slate-50 border border-transparent",
      viewMode === 'focus' && !isActive && 'opacity-80'
    );
    const commonBlockContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-400">{block.title || `Block ${block.id}`}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteBlock(block.id);
              }}
              className="rounded-md border border-rose-200 bg-white p-2 text-rose-700 hover:bg-rose-100"
              type="button"
              aria-label={`Delete ${block.title || block.id}`}
              title="Delete block"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                const formatted = formatSourceForScript(block.source, primaryOutputScript, {
                  romanOutputStyle,
                  tamilOutputStyle,
                }, {
                  sanskritFontPreset,
                });
                void handleCopyBlock(block.id, formatted);
              }}
              className={clsx(
                'rounded-md border p-2',
                copiedId === block.id
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : copiedId === `error:${block.id}`
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
              )}
              type="button"
              aria-label={`Copy ${block.title || block.id}`}
              title={copiedId === block.id ? 'Copied' : copiedId === `error:${block.id}` ? 'Copy failed' : 'Copy block'}
            >
              {copiedId === block.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="mt-2">
          <ScriptText
            script="devanagari"
            text={block.rendered}
            sanskritFontPreset={sanskritFontPreset}
            style={{
              fontSize: `${documentTypography.devanagariFontSize}px`,
              lineHeight: documentTypography.devanagariLineHeight,
            }}
          />
        </div>
        {showModeSourceCard && (
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
              {viewMode === 'focus' ? 'Focused Source' : 'ITRANS Source'}
            </p>
            <p
              className="mt-2 font-mono text-slate-700"
              style={{
                fontSize: `${documentTypography.itransFontSize}px`,
                lineHeight: documentTypography.itransLineHeight,
              }}
            >
              {block.source || 'No source text in this block yet.'}
            </p>
          </div>
        )}
      </>
    );

    if (viewMode === 'focus') {
      const isLongAndActiveInFocus = isLongBlock && isActive;
      return (
        <div key={block.id} className={clsx(blockClassName, isLongAndActiveInFocus && "bg-blue-100 border-blue-500")} onClick={() => activateBlock(block.id)} data-testid="document-focus-mode">
          {commonBlockContent}
          {isLongAndActiveInFocus && block.segments && (
            <div className="mt-4 border-t border-blue-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Segments (Editing Chunks)</h4>
              <div className="space-y-2">
                {block.segments.map((segment, index) => (
                  <div key={segment.id} className={clsx("p-2 rounded text-xs font-mono text-blue-700 bg-blue-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400", activeChunkGroup && index >= activeChunkGroup.startSegmentIndex && index <= activeChunkGroup.endSegmentIndex && "bg-blue-200 border border-blue-400")} onClick={(e) => { e.stopPropagation(); activateChunk(block.id, index); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateChunk(block.id, index); } }} tabIndex={0} role="button" aria-label={`Edit chunk ${index + 1} in ${block.title || block.id}`} style={{ fontSize: `${documentTypography.itransFontSize}px`, lineHeight: documentTypography.itransLineHeight }}>
                    {segment.source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    if (viewMode === 'review') {
      const isLongAndActiveInReview = isLongBlock && isActive;
      return (
        <div key={block.id} className={clsx(blockClassName, isLongAndActiveInReview && "bg-blue-100 border-blue-500")} onClick={() => activateBlock(block.id)} data-testid={`document-review-block-${block.id}`}>
          {commonBlockContent}
          {isLongAndActiveInReview && block.segments && (
            <div className="mt-4 border-t border-blue-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Segments (Source & Rendered)</h4>
              <div className="space-y-2">
                {block.segments.map((segment, index) => (
                  <div key={segment.id} className={clsx("p-2 rounded bg-slate-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400", activeChunkGroup && index >= activeChunkGroup.startSegmentIndex && index <= activeChunkGroup.endSegmentIndex && "bg-blue-200 border border-blue-400")} onClick={(e) => { e.stopPropagation(); activateChunk(block.id, index); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateChunk(block.id, index); } }} tabIndex={0} role="button" aria-label={`Review chunk ${index + 1} in ${block.title || block.id}`} data-testid={`document-review-segment-${block.id}-${index}`}>
                    <p className="font-mono text-slate-700 mb-1" style={{ fontSize: `${documentTypography.itransFontSize}px`, lineHeight: documentTypography.itransLineHeight }}>{segment.source}</p>
                    <div className="mt-1"><ScriptText script="devanagari" text={segment.rendered} sanskritFontPreset={sanskritFontPreset} style={{ fontSize: `${documentTypography.devanagariFontSize}px`, lineHeight: documentTypography.devanagariLineHeight }} /></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const goToImmersiveFindMatch = React.useCallback(
    (direction: 1 | -1) => {
      if (!immersiveFindMatches.length) return;
      const nextIndex =
        (immersiveFindActiveMatchIndex + direction + immersiveFindMatches.length) % immersiveFindMatches.length;
      setImmersiveFindActiveMatchIndex(nextIndex);
    },
    [immersiveFindActiveMatchIndex, immersiveFindMatches.length, setImmersiveFindActiveMatchIndex]
  );

  const handleImmersiveFindInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      goToImmersiveFindMatch(event.shiftKey ? -1 : 1);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setImmersiveFindOpen(false);
    }
  };

  const renderDocumentCanvas = () => {
    return (
      <div className="mx-auto w-full max-w-none overflow-x-hidden rounded-[1.5rem] bg-transparent px-6 py-0 sm:px-10">
        <div className="space-y-8">
          {blocks.map((block) => {
            const isActive = block.id === activeBlockId;
            const formatted = formatSourceForScript(block.source, primaryOutputScript, { romanOutputStyle, tamilOutputStyle }, { sanskritFontPreset });
            return (
              <div key={block.id} onMouseDown={(e) => { e.preventDefault(); activateBlock(block.id); }} onClick={(event) => { const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-source-start]'); if (!target) return; handleReadBlockClick(block, event); }} data-testid={`document-canvas-block-${block.id}`} className={clsx('group relative cursor-pointer transition-all', isActive ? 'bg-blue-50/30 px-4 py-2 rounded-xl ring-1 ring-blue-100' : 'hover:bg-slate-50/50 px-4 py-2 rounded-xl')}>
                {isActive && <div className="absolute left-0 top-1/2 -translate-x-4 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-full shadow-sm" />}
                <div className="pointer-events-none absolute right-0 top-0 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={(e) => { e.stopPropagation(); void handleCopyBlock(block.id, formatted); }} className={clsx('pointer-events-auto rounded-md border p-1.5 shadow-sm', copiedId === block.id ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white/90 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-200')} type="button" aria-label="Copy block text" title={copiedId === block.id ? 'Copied' : 'Copy block'}>
                    {copiedId === block.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="space-y-2">
                  {showItransInDocument && <p data-testid={`document-canvas-source-block-${block.id}`} className="whitespace-pre-wrap break-words font-mono text-slate-400 mb-1 opacity-60 group-hover:opacity-100 transition-opacity" style={{ fontSize: `${documentTypography.itransFontSize * 0.8}px`, lineHeight: 1.2 }}>{renderInteractiveItransText(block.id, block.source)}</p>}
                  <div className="whitespace-pre-wrap break-words text-slate-900">{renderInteractiveSourceText(block, 'document', block.source, primaryOutputScript, { fontSize: `${getRenderedFontSizeForScript(primaryOutputScript)}px`, lineHeight: getRenderedLineHeightForScript(primaryOutputScript) })}</div>
                </div>
              </div>
            );
          })}
          {blocks.length === 0 && <p className="text-center text-slate-300 font-medium py-20 italic">Start typing in the composer above to begin your document...</p>}
        </div>
      </div>
    );
  };

  if (viewMode === 'read' || viewMode === 'immersive') {
    const viewTestIdPrefix = viewMode === 'immersive' ? 'document-immersive' : 'document-read';
    const isImmersive = viewMode === 'immersive';
    const immersiveTopInsetClass = isImmersive ? 'pt-20 sm:pt-24' : 'pt-3 sm:pt-5';

    if (isImmersive) {
      return (
        <div className="fixed inset-0 z-[130] flex min-h-0 w-full h-full overflow-hidden bg-slate-50">
          <div
            ref={documentContainerRef}
            data-testid="main-document-scroll-container"
            tabIndex={0}
            className={clsx(
              'min-h-0 flex-1 min-w-0 outline-none overflow-y-scroll custom-scrollbar px-2 pr-[4px] sm:px-4 sm:pr-[4px]',
              immersiveTopInsetClass
            )}
            onKeyDown={handleReadModeKeyDown}
          >
            <div className="mx-auto flex h-full w-full max-w-none flex-1 flex-col rounded-[1.5rem] px-0 py-0">
              <div
                className="font-serif text-slate-900 flex min-h-0 flex-1 flex-col"
                data-testid="document-immersive-mode"
                data-compare-mode="single"
                data-compare-layout="single"
                style={{
                  fontSize: `${documentTypography.devanagariFontSize}px`,
                  lineHeight: documentTypography.devanagariLineHeight,
                }}
              >
                <section
                  data-testid="document-immersive-primary-pane"
                  className="group relative flex min-h-0 flex-1 flex-col rounded-[1.25rem] border border-slate-100/70 bg-white/85 shadow-sm"
                >
                  <div
                    ref={primaryPaneScrollRef}
                    data-testid="document-immersive-scroll-region"
                    className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-scroll custom-scrollbar py-2.5 sm:py-4"
                  >
                    {blocks
                      .filter((block) => block.rendered.trim().length > 0)
                      .map((block, index) => renderScriptBlock(block, primaryOutputScript, 'primary', viewTestIdPrefix, index + 1))}
                  </div>
                </section>
              </div>
            </div>
          </div>
          {immersiveFindOpen && (
            <div
              className="fixed left-4 top-16 z-[170] w-[22rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-200 backdrop-blur"
              data-testid="immersive-find-overlay"
            >
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="immersive-find-input">
                  Find in immersive view
                </label>
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  id="immersive-find-input"
                  ref={immersiveFindInputRef}
                  value={immersiveFindQuery}
                  onChange={(event) => setImmersiveFindQuery(event.target.value)}
                  onKeyDown={handleImmersiveFindInputKeyDown}
                  placeholder="Search Roman/ITRANS"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
                  data-testid="immersive-find-input"
                />
                <button
                  type="button"
                  onClick={() => setImmersiveFindOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Close find overlay"
                  title="Close find"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2" data-testid="immersive-find-preview">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Preview</p>
                <div className="mt-1 text-sm text-slate-700">
                  {immersiveFindPreviewText ? (
                    <ScriptText
                      script={primaryOutputScript}
                      text={immersiveFindPreviewText}
                      sanskritFontPreset={sanskritFontPreset}
                      tamilFontPreset={tamilFontPreset}
                      className="text-sm font-semibold text-slate-800"
                    />
                  ) : (
                    <span className="text-slate-400">Transliterated result appears here.</span>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => goToImmersiveFindMatch(-1)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Previous match"
                  title="Previous match"
                  disabled={immersiveFindMatches.length === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => goToImmersiveFindMatch(1)}
                  className="inline-flex h-9 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Next match"
                  title="Next match"
                  disabled={immersiveFindMatches.length === 0}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div
                  className="min-w-16 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-black tabular-nums text-slate-500"
                  data-testid="immersive-find-counter"
                >
                  {immersiveFindMatches.length === 0
                    ? 'No matches'
                    : `${Math.min(immersiveFindActiveMatchIndex, immersiveFindMatches.length - 1) + 1} / ${immersiveFindMatches.length}`}
                </div>
              </div>
            </div>
          )}
          {annotationTarget && (
            <div
              className="fixed z-[150] flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-xl shadow-slate-200 backdrop-blur"
              style={{
                left: Math.min(
                  annotationTarget.left + 8,
                  (typeof window === 'undefined' ? 1024 : window.innerWidth) - 190
                ),
                top: Math.max(72, annotationTarget.top - 48),
              }}
              data-testid="annotation-floating-toolbar"
            >
              <span className="max-w-28 truncate px-2 text-xs font-bold text-slate-600">
                {annotationTarget.displayText}
              </span>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-200 text-yellow-950 ring-1 ring-yellow-300 hover:bg-yellow-300" aria-label="Highlight yellow" title="Highlight yellow" onClick={() => applyAnnotationToTarget('highlight', 'yellow')}><Highlighter className="h-4 w-4" /></button>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-200 text-red-950 ring-1 ring-red-300 hover:bg-red-300" aria-label="Highlight red" title="Highlight red" onClick={() => applyAnnotationToTarget('highlight', 'red')}><Highlighter className="h-4 w-4" /></button>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-blue-700 hover:bg-blue-50" aria-label="Toggle bookmark" title="Toggle bookmark" onClick={() => applyAnnotationToTarget('bookmark')}><Bookmark className="h-4 w-4" /></button>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close annotation toolbar" title="Close" onClick={() => setAnnotationTarget(null)}><X className="h-4 w-4" /></button>
            </div>
          )}
          {annotationEditWarning && (
            <div className="fixed bottom-4 left-4 z-[150] flex max-w-md items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-lg">
              <span>{annotationEditWarning.message}</span>
              <button type="button" className="rounded-lg p-1 text-amber-700 hover:bg-amber-100" aria-label="Dismiss annotation warning" title="Dismiss" onClick={dismissAnnotationEditWarning}><X className="h-4 w-4" /></button>
            </div>
          )}
          <aside
            className={clsx(
              'z-[135] flex h-full shrink-0 flex-col border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-sm transition-all duration-300',
              isAnnotationNavigatorOpen ? 'w-80' : 'w-12'
            )}
            data-testid="annotation-navigator"
          >
            <div className="flex h-20 shrink-0 items-end px-2 pb-2">
              <div className="flex w-full items-center justify-between gap-2">
                {isAnnotationNavigatorOpen && (
                  <span className="px-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Annotations
                  </span>
                )}
                <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label={isAnnotationNavigatorOpen ? 'Collapse annotation navigator' : 'Expand annotation navigator'} title={isAnnotationNavigatorOpen ? 'Collapse annotations' : 'Expand annotations'} onClick={() => setAnnotationNavigatorOpen(!isAnnotationNavigatorOpen)}>{isAnnotationNavigatorOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}</button>
              </div>
            </div>
            {isAnnotationNavigatorOpen && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex items-center gap-1 p-2 border-b border-slate-100 shrink-0">
                  <button type="button" className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous annotation" title="Previous annotation" disabled={sortedAnnotations.length === 0} onClick={() => navigateAnnotation(-1)}><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" className="inline-flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next annotation" title="Next annotation" disabled={sortedAnnotations.length === 0} onClick={() => navigateAnnotation(1)}><ChevronRight className="h-4 w-4" /></button>
                  <button type="button" className="inline-flex h-8 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label={showAnnotationOverlay ? 'Hide annotation overlay' : 'Show annotation overlay'} title={showAnnotationOverlay ? 'Hide overlay' : 'Show overlay'} onClick={() => setShowAnnotationOverlay(!showAnnotationOverlay)}>{showAnnotationOverlay ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</button>
                </div>
                <div
                  data-testid="annotation-navigator-scroll"
                  className="min-h-0 flex-1 overflow-y-scroll custom-scrollbar p-2 pb-20"
                >
                  {sortedAnnotations.length === 0 ? (
                    <p className="px-2 py-8 text-center text-xs font-semibold text-slate-400">No annotations</p>
                  ) : (
                    <div className="space-y-2">
                      {sortedAnnotations.map((annotation) => {
                        const blockIndex = (blockOrder.get(annotation.blockId) ?? 0) + 1;
                        const previewText = getAnnotationPreviewDisplayText(annotation);
                        return (
                          <button key={annotation.id} type="button" className="group flex w-full items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2 py-2 text-left hover:border-blue-200 hover:bg-blue-50" onClick={() => scrollToAnnotation(annotation)}>
                            <span className={clsx('mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', annotation.kind === 'bookmark' && 'border-blue-200 bg-blue-50 text-blue-700', annotation.color === 'yellow' && 'border-yellow-300 bg-yellow-200 text-yellow-950', annotation.color === 'red' && 'border-red-300 bg-red-200 text-red-950')}>{annotation.kind === 'bookmark' ? <Bookmark className="h-3 w-3" /> : <Highlighter className="h-3 w-3" />}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold text-slate-800"><ScriptText script={primaryOutputScript} text={previewText} sanskritFontPreset={sanskritFontPreset} tamilFontPreset={tamilFontPreset} className="text-sm font-bold" /></span>
                              <span className="mt-0.5 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">Line {blockIndex}</span>
                            </span>
                            <span role="button" tabIndex={0} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-300 opacity-0 hover:bg-white hover:text-rose-600 group-hover:opacity-100" aria-label="Remove annotation" title="Remove annotation" onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeAnnotation(annotation.id); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); removeAnnotation(annotation.id); } }}><X className="h-3 w-3" /></span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      );
    }

    return (
      <div className="flex flex-1 min-h-0 w-full overflow-hidden flex-col">
        <div ref={documentContainerRef} data-testid="main-document-scroll-container" tabIndex={0} className={clsx('flex-1 min-h-0 outline-none flex h-full flex-col overflow-hidden px-4 sm:px-8', immersiveTopInsetClass)} onKeyDown={handleReadModeKeyDown} onMouseDown={() => { documentContainerRef.current?.focus({ preventScroll: true }); }}>
          <div className="mx-auto w-full max-w-none flex h-full min-h-0 flex-col rounded-[1.5rem] px-0 py-0">
            <div className="font-serif text-slate-900 flex h-full min-h-0 flex-col" data-testid="document-read-mode" data-compare-mode="single" data-compare-layout="single" style={{ fontSize: `${documentTypography.devanagariFontSize}px`, lineHeight: documentTypography.devanagariLineHeight }}>
              <div className="grid flex-1 min-h-0 gap-3 grid-cols-1">
                <section data-testid={`${viewTestIdPrefix}-primary-pane`} className="group relative overflow-hidden rounded-[1.25rem] border border-slate-100/70 bg-white/85 shadow-sm flex min-h-0 flex-1 flex-col" style={{ minHeight: `${documentTypography.primaryPaneHeight}px` }}>
                  <div ref={primaryPaneScrollRef} className="flex h-full min-h-0 flex-col gap-3 overflow-y-scroll custom-scrollbar px-2.5 py-2.5 sm:px-4 sm:py-4">
                    {blocks.filter((block) => block.rendered.trim().length > 0).map((block, index) => renderScriptBlock(block, primaryOutputScript, 'primary', viewTestIdPrefix, index + 1))}
                  </div>
                  <ResizeHandle size={documentTypography.primaryPaneHeight} minSize={240} maxSize={700} ariaLabel="Resize primary read pane height" onSizeChange={updateDocumentHeight('primaryPaneHeight')} axis="y" />
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={documentContainerRef} className="flex-1 overflow-y-scroll custom-scrollbar py-8 px-4" data-testid="main-document-scroll-container">
      {viewMode === 'document' ? (
        renderDocumentCanvas()
      ) : (
        <div className="max-w-5xl mx-auto space-y-8">
          {blocks.map(renderBlock)}
        </div>
      )}
    </div>
  );
};
