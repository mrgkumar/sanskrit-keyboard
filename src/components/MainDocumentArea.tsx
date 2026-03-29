// app/src/components/MainDocumentArea.tsx
'use client';

import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { CanonicalBlock } from '@/store/types';
import { clsx } from 'clsx';
import { Check, Copy } from 'lucide-react';

export const MainDocumentArea: React.FC = () => {
  const { blocks, editorState, setActiveBlockId, activateBlockChunk, getActiveChunkGroup, typography } = useFlowStore();
  const { activeBlockId, viewMode } = editorState;
  const activeChunkGroup = getActiveChunkGroup(); // Get active chunk group
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!copiedId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedId(null);
    }, 1500);

    return () => window.clearTimeout(timeoutId);
  }, [copiedId]);

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

  const renderBlock = (block: CanonicalBlock) => {
    const isActive = block.id === activeBlockId;
    const isLongBlock = block.type === 'long';

    // Base styling for all blocks
    const blockClassName = clsx(
      "p-4 rounded-lg cursor-pointer transition-all",
      isActive ? "bg-blue-50 border-2 border-blue-300 shadow-md" : "hover:bg-slate-50 border border-transparent"
    );

    const commonBlockContent = (
      <>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-400">{block.title || `Block ${block.id}`}</h3>
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
        <p
          className="font-serif text-slate-800 mt-2"
          style={{
            fontSize: `${typography.renderedFontSize}px`,
            lineHeight: typography.renderedLineHeight,
          }}
        >
          {block.rendered}
        </p>
      </>
    );

    // --- Read Mode ---
    if (viewMode === 'read') {
      return (
        <div key={block.id} className={blockClassName} onClick={() => setActiveBlockId(block.id)}>
          {commonBlockContent}
        </div>
      );
    }

    // --- Focus Mode (and default if not Read/Review) ---
    // --- Focus Mode ---
    if (viewMode === 'focus') {
      const isLongAndActiveInFocus = isLongBlock && isActive;
      return (
        <div 
          key={block.id}
          className={clsx(blockClassName, isLongAndActiveInFocus && "bg-blue-100 border-blue-500")}
          onClick={() => activateBlock(block.id)}
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
                      fontSize: `${Math.max(12, typography.itransFontSize - 4)}px`,
                      lineHeight: typography.itransLineHeight,
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
                  >
                    <p
                      className="font-mono text-slate-700 mb-1"
                      style={{
                        fontSize: `${Math.max(12, typography.itransFontSize - 2)}px`,
                        lineHeight: typography.itransLineHeight,
                      }}
                    >
                      {segment.source}
                    </p>
                    <p
                      className="font-serif text-slate-800"
                      style={{
                        fontSize: `${Math.max(20, typography.renderedFontSize - 8)}px`,
                        lineHeight: typography.renderedLineHeight,
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

  return (
    <div className="flex-1 overflow-y-auto py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {blocks.map(renderBlock)}
      </div>
    </div>
  );
};
