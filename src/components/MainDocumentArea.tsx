// app/src/components/MainDocumentArea.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { CanonicalBlock } from '@/store/types';
import { clsx } from 'clsx';
import { Check, Copy, Trash2 } from 'lucide-react';
import { formatSourceForScript, transliterate } from '@/lib/vedic/utils';
import { ScriptText } from '@/components/ScriptText';
import { ResizeHandle } from '@/components/VerticalResizeHandle';

export const MainDocumentArea: React.FC = () => {
  const { blocks, editorState, setActiveBlockId, activateBlockChunk, deleteBlock, getActiveChunkGroup, displaySettings, setViewMode, setComposerSelection, setTypography } = useFlowStore();
  const { activeBlockId, viewMode, focusSpan } = editorState;
  const activeChunkGroup = getActiveChunkGroup(); // Get active chunk group
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
  const documentContainerRef = React.useRef<HTMLDivElement | null>(null);
  const primaryPaneScrollRef = React.useRef<HTMLDivElement | null>(null);
  const readModeBlocks = React.useMemo(
    () => blocks.filter((block) => block.rendered.trim().length > 0),
    [blocks]
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
  React.useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedId(null);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copiedId]);

  React.useEffect(() => {
    if (viewMode !== 'review' || !activeBlockId) {
      return;
    }

    const scrollActiveTargetIntoView = () => {
      const container = documentContainerRef.current;
      if (!container) {
        return;
      }

      const target =
        (activeChunkGroup
          ? container.querySelector<HTMLElement>(
              `[data-testid="document-review-segment-${activeChunkGroup.blockId}-${activeChunkGroup.startSegmentIndex}"]`
            )
          : null) ??
        container.querySelector<HTMLElement>(`[data-testid="document-review-block-${activeBlockId}"]`);

      if (!target) {
        return;
      }

      target.scrollIntoView({ block: 'center', behavior: 'auto' });
    };

    const rafId = window.requestAnimationFrame(scrollActiveTargetIntoView);
    return () => window.cancelAnimationFrame(rafId);
  }, [activeBlockId, activeChunkGroup, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'read' && viewMode !== 'immersive') {
      return;
    }

    setSelectedReadBlockId((current) => {
      if (current && readModeBlocks.some((block) => block.id === current)) {
        return current;
      }

      return activeBlockId ?? readModeBlocks[0]?.id ?? null;
    });
  }, [activeBlockId, readModeBlocks, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'read' && viewMode !== 'immersive') {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      documentContainerRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'read' || !selectedReadBlockId) {
      return;
    }

    const scrollSelectedReadLineIntoView = () => {
      const container = documentContainerRef.current;
      if (!container) {
        return;
      }

      const target = container.querySelector<HTMLElement>(`[data-testid="document-read-block-${selectedReadBlockId}"]`);
      if (!target) {
        return;
      }

      // Bias the active line lower in the viewport so the sticky composer chrome does not cover it.
      target.scrollIntoView({ block: 'end', behavior: 'auto' });
    };

    const rafId = window.requestAnimationFrame(scrollSelectedReadLineIntoView);
    return () => window.cancelAnimationFrame(rafId);
  }, [selectedReadBlockId, viewMode]);

  React.useEffect(() => {
    if (viewMode !== 'document' || !activeBlockId) {
      return;
    }

    const scrollActiveDocumentBlockIntoView = () => {
      const container = documentContainerRef.current;
      if (!container) {
        return;
      }

      const target = container.querySelector<HTMLElement>(`[data-testid="document-canvas-block-${activeBlockId}"]`);
      if (!target) {
        return;
      }

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

  const activateBlock = (blockId: string) => {
    setActiveBlockId(blockId);
  };

  const activateChunk = (blockId: string, segmentIndex: number) => {
    activateBlockChunk(blockId, segmentIndex);
  };

  const selectReadLine = (blockId: string) => {
    setSelectedReadBlockId(blockId);
    documentContainerRef.current?.focus();
  };

  const moveReadLineSelection = (direction: 1 | -1) => {
    if (readModeBlocks.length === 0) {
      return;
    }

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
    if (viewMode !== 'read' && viewMode !== 'immersive') {
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }

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

    if (!target) {
      return null;
    }

    const sourceStart = Number(target.dataset.sourceStart);
    const sourceEnd = Number(target.dataset.sourceEnd);
    if (Number.isNaN(sourceStart) || Number.isNaN(sourceEnd)) {
      return null;
    }

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

    const sourceHit = getSourceHitFromPointer(event);
    if (!sourceHit) {
      jumpToEditPosition(block, 0);
      return;
    }

    jumpToEditPosition(block, sourceHit.caret);
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
        window.requestAnimationFrame(() => {
          setComposerSelection(chunkLocalOffset, chunkLocalOffset);
        });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => applyComposerSelection(attempt + 1), 40);
      }
    };
    window.setTimeout(() => applyComposerSelection(0), 0);
  };

  const handleImmersiveBlockClick = (block: CanonicalBlock) => {
    selectReadLine(block.id);
  };

  const handleImmersiveBlockDoubleClick = (block: CanonicalBlock) => {
    selectReadLine(block.id);
    setViewMode('read');
  };

  const renderInteractiveSourceText = (
    blockKey: string,
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

      if (cursor < start) {
        nodes.push(sourceText.slice(cursor, start));
      }

      const sourceSlice = sourceText.slice(start, end);
      const formattedSlice = formatSourceForScript(sourceSlice, script, {
        romanOutputStyle,
        tamilOutputStyle,
      }, {
        sanskritFontPreset,
      });

      nodes.push(
        <span
          key={`${blockKey}-${paneRole}-${start}-${end}`}
          data-source-start={start}
          data-source-end={end}
          data-target-index={sourceToTargetMap?.[start] ?? start}
          className="inline"
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

    if (cursor < sourceText.length) {
      nodes.push(sourceText.slice(cursor));
    }

    return nodes;
  };

  const renderInteractiveItransText = (blockKey: string, sourceText: string) => {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;

    for (const match of sourceText.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;

      if (cursor < start) {
        nodes.push(sourceText.slice(cursor, start));
      }

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

    if (cursor < sourceText.length) {
      nodes.push(sourceText.slice(cursor));
    }

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
              block.id,
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
            block.id,
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

  if (viewMode === 'read' || viewMode === 'immersive') {
    const viewTestIdPrefix = viewMode === 'immersive' ? 'document-immersive' : 'document-read';
    const isImmersive = viewMode === 'immersive';
    const immersiveTopInsetClass = isImmersive ? 'pt-20 sm:pt-24' : 'py-3 sm:py-5';

    return (
      <div
        ref={documentContainerRef}
        data-testid="main-document-scroll-container"
        tabIndex={0}
        className={clsx(
          'flex-1 outline-none',
          isImmersive ? `overflow-hidden px-2 ${immersiveTopInsetClass} sm:px-4` : 'overflow-y-auto px-4 py-3 sm:px-8 sm:py-5'
        )}
        style={isImmersive ? { height: 'calc(100dvh - 5rem)' } : undefined}
        onKeyDown={handleReadModeKeyDown}
        onMouseDown={() => {
          if (viewMode === 'read' || viewMode === 'immersive') {
            documentContainerRef.current?.focus();
          }
        }}
      >
        <div
          className={clsx(
            'mx-auto w-full max-w-none bg-transparent',
            isImmersive
              ? 'flex h-full flex-col rounded-[1.5rem] px-0 py-0'
              : 'rounded-[1.5rem] px-0 py-0'
          )}
        >
          <div
            className={clsx(
              'font-serif text-slate-900',
              isImmersive && 'flex h-full min-h-0 flex-col'
            )}
            data-testid={isImmersive ? 'document-immersive-mode' : 'document-read-mode'}
            data-compare-mode="single"
            data-compare-layout="single"
            style={{
              fontSize: `${documentTypography.devanagariFontSize}px`,
              lineHeight: documentTypography.devanagariLineHeight,
            }}
          >
            <div
              className={clsx(
                'grid gap-3',
                'grid-cols-1',
                isImmersive && 'h-full min-h-0'
              )}
            >
              <section
                data-testid={`${viewTestIdPrefix}-primary-pane`}
                className={clsx(
                  'group relative overflow-hidden rounded-[1.25rem] border border-slate-100/70 bg-white/85 shadow-sm',
                  isImmersive && 'flex min-h-0 flex-1 flex-col'
                )}
                style={isImmersive ? undefined : { height: `${documentTypography.primaryPaneHeight}px` }}
              >
                <div
                  ref={primaryPaneScrollRef}
                  className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-2.5 py-2.5 sm:px-4 sm:py-4"
                >
                  {blocks
                    .filter((block) => block.rendered.trim().length > 0)
                    .map((block, index) => renderScriptBlock(block, primaryOutputScript, 'primary', viewTestIdPrefix, index + 1))}
                </div>
                {!isImmersive && (
                  <ResizeHandle
                    size={documentTypography.primaryPaneHeight}
                    minSize={240}
                    maxSize={700}
                    ariaLabel="Resize primary read pane height"
                    onSizeChange={updateDocumentHeight('primaryPaneHeight')}
                    axis="y"
                  />
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderBlock = (block: CanonicalBlock) => {
    const isActive = block.id === activeBlockId;
    const isLongBlock = block.type === 'long';
    const showModeSourceCard = viewMode === 'focus' ? isActive : viewMode === 'review';

    // Base styling for all blocks
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

    // --- Focus Mode (and default if not Read/Review) ---
    // --- Focus Mode ---
    if (viewMode === 'focus') {
      const isLongAndActiveInFocus = isLongBlock && isActive;
      return (
        <div 
          key={block.id}
          className={clsx(blockClassName, isLongAndActiveInFocus && "bg-blue-100 border-blue-500")}
          onClick={() => activateBlock(block.id)}
          data-testid="document-focus-mode"
        >
          {commonBlockContent}

          {isLongAndActiveInFocus && block.segments && (
            <div className="mt-4 border-t border-blue-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Segments (Editing Chunks)</h4>
              <div className="space-y-2">
                {block.segments.map((segment, index) => (
                  <div 
                    key={segment.id} 
                    className={clsx(
                      "p-2 rounded text-xs font-mono text-blue-700 bg-blue-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400",
                      activeChunkGroup && 
                      index >= activeChunkGroup.startSegmentIndex && 
                      index <= activeChunkGroup.endSegmentIndex && 
                      "bg-blue-200 border border-blue-400" // Highlight active chunk segments
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      activateChunk(block.id, index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        activateChunk(block.id, index);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Edit chunk ${index + 1} in ${block.title || block.id}`}
                    style={{
                      fontSize: `${documentTypography.itransFontSize}px`,
                      lineHeight: documentTypography.itransLineHeight,
                    }}
                  >
                    {segment.source}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // --- Review Mode ---
    if (viewMode === 'review') {
      const isLongAndActiveInReview = isLongBlock && isActive;
      return (
        <div 
          key={block.id}
          className={clsx(blockClassName, isLongAndActiveInReview && "bg-blue-100 border-blue-500")}
          onClick={() => activateBlock(block.id)}
          data-testid={`document-review-block-${block.id}`}
        >
          {commonBlockContent}

          {isLongAndActiveInReview && block.segments && (
            <div className="mt-4 border-t border-blue-200 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Segments (Source & Rendered)</h4>
              <div className="space-y-2">
                {block.segments.map((segment, index) => (
                  <div 
                    key={segment.id} 
                    className={clsx(
                      "p-2 rounded bg-slate-50 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400",
                      activeChunkGroup && 
                      index >= activeChunkGroup.startSegmentIndex && 
                      index <= activeChunkGroup.endSegmentIndex && 
                      "bg-blue-200 border border-blue-400" // Highlight active chunk segments
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      activateChunk(block.id, index);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        activateChunk(block.id, index);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Review chunk ${index + 1} in ${block.title || block.id}`}
                    data-testid={`document-review-segment-${block.id}-${index}`}
                  >
                    <p
                      className="font-mono text-slate-700 mb-1"
                      style={{
                        fontSize: `${documentTypography.itransFontSize}px`,
                        lineHeight: documentTypography.itransLineHeight,
                      }}
                    >
                      {segment.source}
                    </p>
                    <div className="mt-1">
                      <ScriptText
                        script="devanagari"
                        text={segment.rendered}
                        sanskritFontPreset={sanskritFontPreset}
                        style={{
                          fontSize: `${documentTypography.devanagariFontSize}px`,
                          lineHeight: documentTypography.devanagariLineHeight,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null; // Should not reach here
  };

  const renderDocumentCanvas = () => {
    return (
      <div className="mx-auto w-full max-w-none overflow-x-hidden rounded-[1.5rem] bg-transparent px-6 py-0 sm:px-10">
        <div className="space-y-8">
          {blocks.map((block) => {
            const isActive = block.id === activeBlockId;
            const formatted = formatSourceForScript(block.source, primaryOutputScript, {
              romanOutputStyle,
              tamilOutputStyle,
            }, {
              sanskritFontPreset,
            });

            return (
              <div
                key={block.id}
                onMouseDown={(e) => {
                  // Prevent focus from leaving the composer if possible
                  e.preventDefault();
                  activateBlock(block.id);
                }}
                onClick={(event) => {
                  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-source-start]');
                  if (!target) {
                    return;
                  }

                  handleReadBlockClick(block, event);
                }}
                data-testid={`document-canvas-block-${block.id}`}
                className={clsx(
                  'group relative cursor-pointer transition-all',
                  isActive ? 'bg-blue-50/30 px-4 py-2 rounded-xl ring-1 ring-blue-100' : 'hover:bg-slate-50/50 px-4 py-2 rounded-xl'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-x-4 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-full shadow-sm" />
                )}
                <div className="pointer-events-none absolute right-0 top-0 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCopyBlock(block.id, formatted);
                    }}
                    className={clsx(
                      'pointer-events-auto rounded-md border p-1.5 shadow-sm',
                      copiedId === block.id
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-white/90 text-slate-400 border-slate-200 hover:text-blue-600 hover:border-blue-200'
                    )}
                    type="button"
                    aria-label="Copy block text"
                    title={copiedId === block.id ? 'Copied' : 'Copy block'}
                  >
                    {copiedId === block.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="space-y-2">
                  {showItransInDocument && (
                    <p
                      data-testid={`document-canvas-source-block-${block.id}`}
                      className="whitespace-pre-wrap break-words font-mono text-slate-400 mb-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{
                        fontSize: `${documentTypography.itransFontSize * 0.8}px`,
                        lineHeight: 1.2,
                      }}
                    >
                      {renderInteractiveItransText(block.id, block.source)}
                    </p>
                  )}
                  <div className="whitespace-pre-wrap break-words text-slate-900">
                    {renderInteractiveSourceText(
                      block.id,
                      'document',
                      block.source,
                      primaryOutputScript,
                      {
                        fontSize: `${getRenderedFontSizeForScript(primaryOutputScript)}px`,
                        lineHeight: getRenderedLineHeightForScript(primaryOutputScript),
                      }
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {blocks.length === 0 && (
            <p className="text-center text-slate-300 font-medium py-20 italic">Start typing in the composer above to begin your document...</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div ref={documentContainerRef} className="flex-1 overflow-y-auto py-8 px-4" data-testid="main-document-scroll-container">
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
