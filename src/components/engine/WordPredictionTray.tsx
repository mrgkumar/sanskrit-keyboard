import React from 'react';
import { clsx } from 'clsx';
import { useFlowStore } from '@/store/useFlowStore';
import type { ChunkEditTarget } from '@/store/types';
import { formatSourceForScript } from '@/lib/vedic/utils';
import { ScriptText } from '@/components/ScriptText';

type WordPredictionTrayVariant = 'inline' | 'split' | 'footer' | 'listbox';

interface WordPredictionTrayProps {
  variant: WordPredictionTrayVariant;
  className?: string;
  style?: React.CSSProperties;
  onSuggestionAccepted?: () => void;
}

export const WordPredictionTray: React.FC<WordPredictionTrayProps> = ({
  variant,
  className,
  style,
  onSuggestionAccepted,
}) => {
  const {
    activeBuffer,
    lexicalSuggestions,
    isLexicalSuggestionsLoading,
    lexicalSelectedSuggestionIndex,
    swaraPredictionEnabled,
    getActiveChunkGroup,
    recordSessionLexicalUse,
    setLexicalSelectedSuggestionIndex,
    updateChunkSource,
    composerSelectionEnd,
    displaySettings,
  } = useFlowStore();
  const {
    primaryOutputScript,
    romanOutputStyle,
    tamilOutputStyle,
  } = displaySettings;

  const activeChunkGroup = getActiveChunkGroup();
  const currentChunkSource = activeChunkGroup?.source || '';
  const currentEditTarget: ChunkEditTarget | undefined = activeChunkGroup?.blockId
    ? {
        blockId: activeChunkGroup.blockId,
        startSegmentIndex: activeChunkGroup.startSegmentIndex,
        endSegmentIndex: activeChunkGroup.endSegmentIndex,
        source: activeChunkGroup.source,
      }
    : undefined;
  const showLexicalSuggestions = lexicalSuggestions.length > 0 && activeBuffer.length > 1;

  if (!showLexicalSuggestions) {
    return null;
  }

  const handleLexicalInsert = (itrans: string, index: number) => {
    setLexicalSelectedSuggestionIndex(index);
    const replacementLength = activeBuffer.length;
    const replaceEnd = composerSelectionEnd ?? currentChunkSource.length;
    const replaceStart = Math.max(0, replaceEnd - replacementLength);
    const newSource =
      currentChunkSource.slice(0, replaceStart) +
      itrans +
      currentChunkSource.slice(replaceEnd);
    const nextCaret = replaceStart + itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
    recordSessionLexicalUse(itrans);
    onSuggestionAccepted?.();
  };

  const isInline = variant === 'inline';
  const isSplit = variant === 'split';
  const isListbox = variant === 'listbox';
  const visibleSuggestions = lexicalSuggestions.slice(0, isInline ? 6 : isListbox ? 7 : 5);

  return (
    <section
      data-testid={`word-predictions-${variant}`}
      className={clsx(
        'border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/70',
        isInline
          ? 'rounded-lg border-dashed px-2 py-1.5 shadow-sm'
          : isListbox
            ? 'rounded-xl px-2.5 py-2 shadow-xl ring-1 ring-emerald-100'
          : isSplit
            ? 'rounded-xl px-3 py-2.5 shadow-sm'
            : 'rounded-2xl px-3 py-2.5 shadow-sm',
        className
      )}
      style={style}
    >
      <div className={clsx('flex items-center justify-between gap-2', (isInline || isListbox) && 'mb-1')}>
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
            Word Predictions{isLexicalSuggestionsLoading ? '…' : ''}
          </p>
          {!(isInline || isListbox) && (
            <p className="mt-1 text-xs text-emerald-900/80">
              Complete <span className="font-mono font-semibold">{activeBuffer}</span> with a full lexical form
              {swaraPredictionEnabled ? ' or a learned swara-marked variant' : ''}.
            </p>
          )}
        </div>
        <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
          <kbd className="rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 font-mono text-[9px]">Tab</kbd>
          Cycle
          <kbd className="rounded border border-emerald-200 bg-emerald-50 px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
          Accept
        </div>
      </div>

      {isLexicalSuggestionsLoading && (
        <p className="mt-2 text-xs font-medium text-emerald-700/80">Loading word predictions for this prefix…</p>
      )}

      <div
        className={clsx(
          isInline
            ? 'flex gap-2 overflow-x-auto pb-2'
            : isListbox
              ? 'max-h-[15rem] min-h-[12.5rem] space-y-1 overflow-y-auto pr-1'
            : isSplit
              ? 'mt-2 flex max-h-[8.5rem] flex-wrap gap-2 overflow-y-auto pr-1'
              : 'mt-2 flex flex-wrap gap-2 overflow-y-auto pr-1'
        )}
        role={isListbox ? 'listbox' : undefined}
        aria-label={isListbox ? 'Word predictions' : undefined}
      >
        {visibleSuggestions.map((entry, index) => {
          const suggestionText = formatSourceForScript(entry.itrans, primaryOutputScript, {
            romanOutputStyle,
            tamilOutputStyle,
          });

          return (
            <button
              key={`${variant}-lex-${index}`}
              data-testid={`lexical-suggestion-${variant}-${index}`}
              onClick={() => handleLexicalInsert(entry.itrans, index)}
              className={clsx(
                'rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.99]',
                isInline
                  ? 'min-w-[9.5rem] shrink-0'
                  : isListbox
                    ? 'flex w-full items-center justify-between gap-3'
                    : 'min-w-[8.5rem]',
                index === lexicalSelectedSuggestionIndex
                  ? 'border-emerald-400 bg-emerald-100 shadow-sm hover:bg-emerald-200'
                  : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
              )}
              aria-label={`Use word prediction ${entry.itrans}`}
              role={isListbox ? 'option' : undefined}
              aria-selected={isListbox ? index === lexicalSelectedSuggestionIndex : undefined}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className={clsx('truncate text-slate-900', isInline ? 'text-sm' : 'text-lg')}>
                    <ScriptText
                      script={primaryOutputScript}
                      text={suggestionText}
                      tamilFontPreset={displaySettings.tamilFontPreset}
                      sanskritFontPreset={displaySettings.sanskritFontPreset}
                    />
                  </div>
                  <kbd className="mt-1 inline-block max-w-full truncate text-[11px] font-mono font-bold tracking-tight text-emerald-800">
                    {entry.itrans}
                  </kbd>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    {entry.count}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
