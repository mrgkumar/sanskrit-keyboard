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
        'border border-slate-200 bg-white/95 backdrop-blur-md',
        isInline
          ? 'rounded-lg border-dashed px-2 py-1.5 shadow-sm bg-gradient-to-r from-blue-50 via-white to-blue-50/70'
          : isListbox
            ? 'rounded-xl shadow-2xl ring-1 ring-slate-200/50 overflow-hidden'
          : isSplit
            ? 'rounded-xl px-3 py-2.5 shadow-sm bg-gradient-to-r from-blue-50 via-white to-blue-50/70'
            : 'rounded-2xl px-3 py-2.5 shadow-sm bg-gradient-to-r from-blue-50 via-white to-blue-50/70',
        className
      )}
      style={style}
    >
      {!(isListbox) && (
        <div className={clsx('flex items-center justify-between gap-2', isInline && 'mb-1')}>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Word Predictions{isLexicalSuggestionsLoading ? '…' : ''}
            </p>
            {!isInline && (
              <p className="mt-1 text-xs text-slate-600">
                Complete <span className="font-mono font-semibold">{activeBuffer}</span> with a full lexical form
                {swaraPredictionEnabled ? ' or a learned swara-marked variant' : ''}.
              </p>
            )}
          </div>
          <div className="inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[9px]">Tab</kbd>
            Cycle
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 font-mono text-[9px]">Enter</kbd>
            Accept
          </div>
        </div>
      )}

      {isLexicalSuggestionsLoading && !isListbox && (
        <p className="mt-2 text-xs font-medium text-slate-500">Loading word predictions for this prefix…</p>
      )}

      <div
        className={clsx(
          isInline
            ? 'flex gap-2 overflow-x-auto pb-2'
            : isListbox
              ? 'max-h-[15rem] overflow-y-auto'
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
          }, {
            sanskritFontPreset: displaySettings.sanskritFontPreset,
          });

          return (
            <button
              key={`${variant}-lex-${index}`}
              data-testid={`lexical-suggestion-${variant}-${index}`}
              onClick={() => handleLexicalInsert(entry.itrans, index)}
              className={clsx(
                'text-left transition-all active:scale-[0.99]',
                isInline
                  ? 'min-w-[9.5rem] shrink-0 rounded-xl border px-3 py-2'
                  : isListbox
                    ? 'flex w-full items-center justify-between gap-3 px-3 py-2.5 border-b last:border-b-0 border-slate-50'
                    : 'min-w-[8.5rem] rounded-xl border px-3 py-2',
                index === lexicalSelectedSuggestionIndex
                  ? 'bg-blue-600 text-white shadow-md'
                  : isListbox 
                    ? 'bg-white hover:bg-blue-50 text-slate-900'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50'
              )}
              aria-label={`Use word prediction ${entry.itrans}`}
              role={isListbox ? 'option' : undefined}
              aria-selected={isListbox ? index === lexicalSelectedSuggestionIndex : undefined}
            >
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex items-baseline gap-3 min-w-0">
                  {isListbox && (
                    <span className={clsx(
                      "text-[10px] font-black w-4 h-4 flex items-center justify-center rounded-md border",
                      index === lexicalSelectedSuggestionIndex 
                        ? "bg-blue-500 border-blue-400 text-white" 
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    )}>
                      {index + 1}
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className={clsx('truncate', isInline ? 'text-sm font-medium' : 'text-base font-bold')}>
                      <ScriptText
                        script={primaryOutputScript}
                        text={suggestionText}
                        className={clsx(index === lexicalSelectedSuggestionIndex ? 'text-white' : 'text-slate-900')}
                        tamilFontPreset={displaySettings.tamilFontPreset}
                        sanskritFontPreset={displaySettings.sanskritFontPreset}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <kbd className={clsx(
                    "font-mono text-[10px] font-bold tracking-tight",
                    index === lexicalSelectedSuggestionIndex ? "text-blue-100" : "text-slate-500"
                  )}>
                    {entry.itrans}
                  </kbd>
                  <span className={clsx(
                    "rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]",
                    index === lexicalSelectedSuggestionIndex ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600"
                  )}>
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
