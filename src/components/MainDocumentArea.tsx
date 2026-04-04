// app/src/components/MainDocumentArea.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { CanonicalBlock } from '@/store/types';
import { clsx } from 'clsx';
import { Check, Copy, Trash2 } from 'lucide-react';
import { formatSourceForScript, transliterate } from '@/lib/vedic/utils';
import { ScriptText } from '@/components/ScriptText';
import { VerticalResizeHandle } from '@/components/VerticalResizeHandle';

export const MainDocumentArea: React.FC = () => {
  const { blocks, editorState, setActiveBlockId, activateBlockChunk, deleteBlock, getActiveChunkGroup, displaySettings, setViewMode, setComposerSelection, setTypography } = useFlowStore();
  const { activeBlockId, viewMode, focusSpan } = editorState;
  const activeChunkGroup = getActiveChunkGroup(); // Get active chunk group
  const {
    typography,
    inputScheme,
    primaryOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
    sanskritFontPreset,
    tamilFontPreset,
    showItransInDocument,
  } = displaySettings;
  const documentTypography = typography.document;
  const updateDocumentHeight = React.useCallback(
    (key: 'primaryPaneHeight' | 'comparePaneHeight') => (nextHeight: number) => {
      setTypography('document', { [key]: nextHeight } as Partial<typeof documentTypography>);
    },
    [setTypography, documentTypography]
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

      // Use 'nearest' for Read mode to avoid double-scroll jumps with the inner pane
      target.scrollIntoView({ block: 'nearest', behavior: 'auto' });
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

      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
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

  const handleReadBlockClick = (
    block: CanonicalBlock,
    script: typeof primaryOutputScript,
    event: React.MouseEvent<HTMLElement>
  ) => {
    selectReadLine(block.id);
    if (script !== 'devanagari') {
      jumpToEditPosition(block, 0);
      return;
    }

    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-target-index]');
    if (!target) {
      jumpToEditPosition(block, 0);
      return;
    }

    const targetIndex = Number(target.dataset.targetIndex);
    if (Number.isNaN(targetIndex)) {
      return;
    }

    const renderedBlock = transliterate(block.source, { inputScheme });
    const renderedChars = Array.from(renderedBlock.unicode);

    let wordStart = targetIndex;
    while (wordStart > 0 && /\S/.test(renderedChars[wordStart - 1] ?? '')) {
      wordStart -= 1;
    }

    const sourceWordStart = renderedBlock.targetToSourceMap[wordStart] ?? 0;
    jumpToEditPosition(block, sourceWordStart);
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
      setComposerSelection(chunkLocalOffset, chunkLocalOffset);
      const composer = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement | null;
      if (composer) {
        composer.focus({ preventScroll: true });
        composer.setSelectionRange(chunkLocalOffset, chunkLocalOffset);
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
      'grid items-start gap-3 rounded-md px-1 py-1 transition-colors',
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
      const renderedBlock = transliterate(block.source, { inputScheme });
      const renderedChars = Array.from(renderedBlock.unicode);

      return (
        <div
          key={`${block.id}-${paneRole}`}
          className={wrapperClassName}
          style={lineNumber !== undefined ? { gridTemplateColumns: '2.5rem minmax(0, 1fr)' } : undefined}
        >
          {lineGuide}
          <p
            data-testid={
              paneRole === 'primary'
                ? `${viewTestIdPrefix}-block-${block.id}`
                : `${viewTestIdPrefix}-compare-block-${block.id}`
            }
            className={clsx(
              'script-text-devanagari whitespace-pre-wrap break-words rounded-md px-1 py-1 transition-colors',
              paneRole === 'compare' && 'text-slate-700'
            )}
            data-font-preset={sanskritFontPreset}
            data-selected-read-line={isSelectedReadLine ? 'true' : undefined}
            lang="sa"
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
                  : (event) => handleReadBlockClick(block, script, event)
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
            style={{
              fontSize: `${getRenderedFontSizeForScript(script)}px`,
              lineHeight: getRenderedLineHeightForScript(script),
            }}
          >
            {renderedChars.map((char, index) => (
              <span
                key={`${block.id}-${index}-${char}`}
                data-target-index={index}
                className="cursor-text"
              >
                {char}
              </span>
            ))}
          </p>
        </div>
      );
    }

    const formatted = formatSourceForScript(block.source, script, {
      romanOutputStyle,
      tamilOutputStyle,
    });

    return (
      <div
        key={`${block.id}-${script}-${paneRole}`}
        className={wrapperClassName}
        style={lineNumber !== undefined ? { gridTemplateColumns: '2.5rem minmax(0, 1fr)' } : undefined}
      >
        {lineGuide}
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
                : (event) => handleReadBlockClick(block, script, event)
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
          <ScriptText
            script={script}
            text={formatted}
            sanskritFontPreset={sanskritFontPreset}
            tamilFontPreset={tamilFontPreset}
            style={{
              fontSize: `${getRenderedFontSizeForScript(script)}px`,
              lineHeight: getRenderedLineHeightForScript(script),
            }}
          />
        </p>
      </div>
    );
  };

  if (viewMode === 'read' || viewMode === 'immersive') {
    const viewTestIdPrefix = viewMode === 'immersive' ? 'document-immersive' : 'document-read';
    const isImmersive = viewMode === 'immersive';

    return (
      <div
        ref={documentContainerRef}
        data-testid="main-document-scroll-container"
        tabIndex={0}
        className={clsx(
          'flex-1 outline-none',
          isImmersive ? 'overflow-hidden px-4 py-6 sm:px-8 sm:py-8' : 'overflow-y-auto px-4 py-8'
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
            'mx-auto border border-slate-200 bg-white shadow-sm',
            isImmersive
              ? 'flex h-full max-w-6xl flex-col rounded-[2.25rem] px-6 py-10 sm:px-12'
              : 'max-w-4xl rounded-[2rem] px-6 py-8 sm:px-10'
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
                'grid gap-5',
                'grid-cols-1',
                isImmersive && 'h-full min-h-0'
              )}
            >
              <section
                data-testid={`${viewTestIdPrefix}-primary-pane`}
                className={clsx(
                  'group relative overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/55 shadow-sm',
                  isImmersive && 'flex min-h-0 flex-1 flex-col'
                )}
                style={isImmersive ? undefined : { height: `${documentTypography.primaryPaneHeight}px` }}
              >
                <div
                  ref={primaryPaneScrollRef}
                  className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto px-4 py-4"
                >
                  {blocks
                    .filter((block) => block.rendered.trim().length > 0)
                    .map((block, index) => renderScriptBlock(block, primaryOutputScript, 'primary', viewTestIdPrefix, index + 1))}
                </div>
                {!isImmersive && (
                  <VerticalResizeHandle
                    height={documentTypography.primaryPaneHeight}
                    minHeight={240}
                    maxHeight={700}
                    ariaLabel="Resize primary read pane height"
                    onHeightChange={updateDocumentHeight('primaryPaneHeight')}
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
                void handleCopyBlock(block.id, block.rendered);
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
        <p
          className="script-text-devanagari mt-2 text-slate-800"
          data-font-preset={sanskritFontPreset}
          lang="sa"
          style={{
            fontSize: `${documentTypography.devanagariFontSize}px`,
            lineHeight: documentTypography.devanagariLineHeight,
          }}
        >
          {block.rendered}
        </p>
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
                    <p
                      className="font-serif text-slate-800"
                      style={{
                        fontSize: `${documentTypography.devanagariFontSize}px`,
                        lineHeight: documentTypography.devanagariLineHeight,
                      }}
                    >
                      {segment.rendered}
                    </p>
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
      <div className="mx-auto w-full max-w-4xl overflow-x-hidden rounded-[2.5rem] border border-slate-200 bg-white p-12 shadow-xl sm:p-16">
        <div className="space-y-8">
          {blocks.map((block) => {
            const isActive = block.id === activeBlockId;
            const formatted = formatSourceForScript(block.source, primaryOutputScript, {
              romanOutputStyle,
              tamilOutputStyle,
            });

            return (
              <div
                key={block.id}
                onClick={() => activateBlock(block.id)}
                data-testid={`document-canvas-block-${block.id}`}
                className={clsx(
                  'group relative cursor-pointer transition-all',
                  isActive ? 'bg-blue-50/30 -mx-4 px-4 py-2 rounded-xl ring-1 ring-blue-100' : 'hover:bg-slate-50/50 -mx-4 px-4 py-2 rounded-xl'
                )}
              >
                {isActive && (
                  <div className="absolute -left-8 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-500 rounded-full shadow-sm" />
                )}
                <div className="space-y-2">
                  {showItransInDocument && (
                    <p
                      className="whitespace-pre-wrap break-words font-mono text-slate-400 mb-1 opacity-60 group-hover:opacity-100 transition-opacity"
                      style={{
                        fontSize: `${documentTypography.itransFontSize * 0.8}px`,
                        lineHeight: 1.2,
                      }}
                    >
                      {block.source}
                    </p>
                  )}
                  <p
                    className={clsx(
                      primaryOutputScript === 'devanagari' ? 'script-text-devanagari' : '',
                      'whitespace-pre-wrap break-words text-slate-900'
                    )}
                    data-font-preset={sanskritFontPreset}
                    lang={primaryOutputScript === 'devanagari' ? 'sa' : undefined}
                    style={{
                      fontSize: `${getRenderedFontSizeForScript(primaryOutputScript)}px`,
                      lineHeight: getRenderedLineHeightForScript(primaryOutputScript),
                    }}
                  >
                    {primaryOutputScript === 'devanagari' ? (
                      block.rendered
                    ) : (
                      <ScriptText
                        script={primaryOutputScript}
                        text={formatted}
                        sanskritFontPreset={sanskritFontPreset}
                        tamilFontPreset={tamilFontPreset}
                      />
                    )}
                  </p>
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
