import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { VEDIC_MAPPINGS, MAPPING_TRIE } from '@/lib/vedic/mapping';
import { clsx } from 'clsx';

const DEFAULT_SHORTCUTS = [
  // Vowels
  'a', 'A', 'i', 'I', 'u', 'U', 'RRi',
  // Gutturals
  'k', 'kh', 'g', 'gh', '~N',
  // Palatals
  'ch', 'Ch', 'j', 'jh', '~n',
  // Retroflex
  'T', 'Th', 'D', 'Dh', 'N',
  // Dentals
  't', 'th', 'd', 'dh', 'n',
  // Labials
  'p', 'ph', 'b', 'bh', 'm',
  // Semivowels & Sibilants
  'y', 'r', 'l', 'v', 'sh', 'Sh', 's', 'h',
  // Common Marks
  'M', 'H',
].map(itrans => 
  VEDIC_MAPPINGS.find(m => m.itrans === itrans)
).filter(Boolean) as typeof VEDIC_MAPPINGS;

const PHONETIC_GROUPS = {
  // Stop Consonants (Varga)
  guttural: ['k', 'kh', 'g', 'gh', '~N'],
  palatal: ['ch', 'Ch', 'j', 'jh', '~n'],
  retroflex: ['T', 'Th', 'D', 'Dh', 'N'],
  dental: ['t', 'th', 'd', 'dh', 'n'],
  labial: ['p', 'ph', 'b', 'bh', 'm'],
  
  // Liquids & Sibilants
  liquids: ['y', 'r', 'l', 'v'],
  sibilants: ['sh', 'Sh', 's', 'h'],

  // Vowels (short/long pairs)
  a_vowels: ['a', 'A'],
  i_vowels: ['i', 'I'],
  u_vowels: ['u', 'U'],
  r_vowels: ['RRi', 'RRI'],
  l_vowels: ['LLi', 'LLI'],

  // Marks & Svaras
  marks: ['H', 'M', '.n', '~', '.N'],
  svaras: ["'", '_', '^', "''", '"']
};

// Explicitly defined similar sounds, primarily for ambiguous/confused consonants
const SIMILAR_SOUND_MAP: { [key: string]: string[] } = {
  'n': ['N', '~n'], // Dental n, Retroflex N, Palatal n
  'N': ['n', '~n'],
  '~n': ['n', 'N'],
  's': ['S', 'sh'], // Dental s, Retroflex S, Palatal sh
  'S': ['s', 'sh'],
  'sh': ['s', 'S'],
  'M': ['H'], // Anusvara, Visarga
  'H': ['M'],
  'k': ['kh', 'g', 'gh'], // Some common gutturals
  'g': ['gh', 'k', 'kh'],
  'c': ['ch'], // for 'c' and 'ch'
  'Ch': ['ch'], // for 'Ch' and 'ch'
  't': ['T', 'th', 'd', 'dh', 'D', 'Dh'], // Dental t vs Retroflex T and aspirates
  'T': ['t', 'Th', 'D', 'Dh', 'd', 'dh'],
  'd': ['D', 'dh', 't', 'th', 'T', 'Th'],
  'D': ['d', 'Dh', 't', 'th', 'T', 'Th'],
};

const getPhoneticGroup = (char: string) => {
  for (const key of Object.keys(PHONETIC_GROUPS) as Array<keyof typeof PHONETIC_GROUPS>) {
    if (PHONETIC_GROUPS[key].includes(char)) {
      return PHONETIC_GROUPS[key];
    }
  }
  return null;
};

export const ShortcutHUD: React.FC = () => {
  const { 
    activeBuffer,
    suggestions, 
    alternateSuggestions, 
    lexicalSuggestions,
    isLexicalSuggestionsLoading,
    lexicalSelectedSuggestionIndex,
    selectedSuggestionIndex,
    swaraPredictionEnabled,
    getActiveChunkGroup,
    recordSessionLexicalUse,
    setLexicalSelectedSuggestionIndex,
    updateChunkSource,
    composerSelectionStart,
    composerSelectionEnd,
  } = useFlowStore();

  const activeChunkGroup = getActiveChunkGroup();
  const currentChunkSource = activeChunkGroup?.source || '';

  const handleInsert = (itrans: string, tail: string) => {
    const replacementLength = tail.length;
    const replaceEnd = composerSelectionEnd ?? currentChunkSource.length;
    const replaceStart = Math.max(0, replaceEnd - replacementLength);
    const newSource =
      currentChunkSource.slice(0, replaceStart) +
      itrans +
      currentChunkSource.slice(replaceEnd);
    const nextCaret = replaceStart + itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret);
  };

  const handleQuickInsert = (itrans: string) => {
    const start = composerSelectionStart ?? currentChunkSource.length;
    const end = composerSelectionEnd ?? start;
    const newSource =
      currentChunkSource.slice(0, start) +
      itrans +
      currentChunkSource.slice(end);
    const nextCaret = start + itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret);
  };

  const handleLexicalInsert = (itrans: string, index: number) => {
    setLexicalSelectedSuggestionIndex(index);
    handleInsert(itrans, activeBuffer);
    recordSessionLexicalUse(itrans);
  };

  // --- Phonetic Completions Logic ---
  let completions: { itrans: string; unicode: string; tail: string; }[] = [];
  let longestItransSuffix = '';

  // Find the longest valid ITRANS code that is a suffix of activeBuffer
  for (let len = activeBuffer.length; len > 0; len--) {
    const suffix = activeBuffer.slice(-len);
    if (MAPPING_TRIE.some(m => m.itrans === suffix)) { // Check if it's a known ITRANS code
      longestItransSuffix = suffix;
      break;
    }
  }

  if (longestItransSuffix) {
    let group: string[] | null = null;

    // Prioritize SIMILAR_SOUND_MAP
    if (SIMILAR_SOUND_MAP[longestItransSuffix]) {
      group = SIMILAR_SOUND_MAP[longestItransSuffix];
    } else {
      // Fallback to PHONETIC_GROUPS
      group = getPhoneticGroup(longestItransSuffix);
    }
    
    if (group) {
      completions = group
        .map((itrans: string) => {
          const mapping = VEDIC_MAPPINGS.find(m => m.itrans === itrans);
          return mapping ? { ...mapping, tail: longestItransSuffix } : null;
        })
        .filter(Boolean) as { itrans: string; unicode: string; tail: string; }[];
    }
  }
  // --- End Phonetic Completions Logic ---

  const showAlternatives = alternateSuggestions.length > 0;
  const showCompletions = completions.length > 0 && activeBuffer.length > 0; // Only show completions if active buffer exists
  const showSuggestions = suggestions.length > 0 && activeBuffer.length > 0;
  const showLexicalSuggestions = lexicalSuggestions.length > 0 && activeBuffer.length > 1;

  const showAnyDynamicHUD = showAlternatives || showCompletions || showSuggestions || showLexicalSuggestions;
  const showCharacterAssist = showAlternatives || showSuggestions || showCompletions;


  return (
    <div className="w-full max-w-5xl px-4">
      {!showAnyDynamicHUD && (
        <div className="flex items-center gap-3 overflow-x-auto h-16 scrollbar-hide">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mr-2 shrink-0">Quick Ref:</span>
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {DEFAULT_SHORTCUTS.map((m, i) => (
              <button
                key={`def-${i}`}
                onClick={() => handleQuickInsert(m.itrans)} // Now functional
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0 active:scale-95 group"
              >
                <span className="text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform">{m.unicode}</span>
                <kbd className="text-[10px] font-mono font-bold text-blue-600 opacity-60 tracking-tighter">{m.itrans}</kbd>
              </button>
            ))}
          </div>
        </div>
      )}

      {showAnyDynamicHUD && (
        <>
          <div className="flex flex-col gap-3 py-2">
            {showLexicalSuggestions && (
              <section
                data-testid="lexical-suggestions"
                className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 px-3 py-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                      Word Predictions{isLexicalSuggestionsLoading ? '…' : ''}
                    </p>
                    <p className="mt-1 text-xs text-emerald-900/80">
                      Complete <span className="font-mono font-semibold">{activeBuffer}</span> with a full lexical form{swaraPredictionEnabled ? ' or a learned swara-marked variant' : ''}.
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                    <kbd className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px]">Tab</kbd>
                    Cycle
                    <kbd className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px]">Enter</kbd>
                    Accept
                  </div>
                </div>
                {isLexicalSuggestionsLoading && (
                  <p className="mt-2 text-xs font-medium text-emerald-700/80">Loading word predictions for this prefix…</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {lexicalSuggestions.map((entry, index) => (
                    <button
                      key={`lex-${index}`}
                      data-testid={`lexical-suggestion-${index}`}
                      onClick={() => handleLexicalInsert(entry.itrans, index)}
                      className={clsx(
                        'min-w-[10rem] rounded-xl border px-3 py-2 text-left transition-all active:scale-[0.99]',
                        index === lexicalSelectedSuggestionIndex
                          ? 'border-emerald-400 bg-emerald-100 shadow-sm hover:bg-emerald-200'
                          : 'border-emerald-200 bg-white hover:border-emerald-300 hover:bg-emerald-50'
                      )}
                      aria-label={`Use word prediction ${entry.itrans}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-serif text-slate-900">{entry.devanagari}</div>
                          <kbd className="mt-1 inline-block text-[11px] font-mono font-bold tracking-tight text-emerald-800">
                            {entry.itrans}
                          </kbd>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {index === lexicalSelectedSuggestionIndex && (
                            <span className="rounded-full bg-emerald-700 px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">
                              Selected
                            </span>
                          )}
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                            {entry.count}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {showCharacterAssist && (
              <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <span>Character Assist</span>
                  <span className="font-normal normal-case tracking-normal text-slate-400">
                    Mapping and sound-level options stay available below the word strip.
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {showAlternatives && alternateSuggestions.map((m, i) => (
                    <button
                      key={`alt-${i}`}
                      onClick={() => handleInsert(m.itrans, activeBuffer)}
                      className={clsx(
                        'flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-lg transition-all shrink-0 active:scale-95 group',
                        i === selectedSuggestionIndex
                          ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      )}
                    >
                      <span className={clsx('text-xs font-bold -ml-1 mr-2 tabular-nums w-4 h-4 rounded-full flex items-center justify-center', i === selectedSuggestionIndex ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>{i + 1}</span>
                      <span className={clsx('text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform', i === selectedSuggestionIndex && 'text-white')}>{m.unicode}</span>
                      <kbd className={clsx('text-[10px] font-mono font-bold tracking-tighter', i === selectedSuggestionIndex ? 'text-blue-100' : 'text-blue-600 opacity-60')}>{m.itrans}</kbd>
                    </button>
                  ))}

                  {showSuggestions && suggestions.map((m, i) => (
                    <button
                      key={`sug-${i}`}
                      onClick={() => handleInsert(m.itrans, activeBuffer)}
                      className={clsx(
                        'flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-lg transition-all shrink-0 active:scale-95 group',
                        i === selectedSuggestionIndex
                          ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
                          : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50'
                      )}
                    >
                      <span className={clsx('text-xs font-bold -ml-1 mr-2 tabular-nums w-4 h-4 rounded-full flex items-center justify-center', i === selectedSuggestionIndex ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>{i + 1}</span>
                      <span className={clsx('text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform', i === selectedSuggestionIndex && 'text-white')}>{m.unicode}</span>
                      <kbd className={clsx('text-[10px] font-mono font-bold tracking-tighter', i === selectedSuggestionIndex ? 'text-blue-100' : 'text-blue-600 opacity-60')}>{m.itrans}</kbd>
                    </button>
                  ))}

                  {showCompletions && completions.map((m, i) => (
                    <button
                      key={`comp-${i}`}
                      onClick={() => handleInsert(m.itrans, m.tail)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all shrink-0 active:scale-95 group"
                    >
                      <span className="text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform">{m.unicode}</span>
                      <kbd className="text-[10px] font-mono font-bold text-blue-600 opacity-60 tracking-tighter">{m.itrans}</kbd>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
};
