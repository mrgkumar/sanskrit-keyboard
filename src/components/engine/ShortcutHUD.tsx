import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { VEDIC_MAPPINGS, MAPPING_TRIE } from '@/lib/vedic/mapping';
import { clsx } from 'clsx';
import type { ChunkEditTarget } from '@/store/types';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';

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
    selectedSuggestionIndex,
    getActiveChunkGroup,
    updateChunkSource,
    composerSelectionStart,
    composerSelectionEnd,
    displaySettings,
  } = useFlowStore();

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

  const handleInsert = (itrans: string, tail: string) => {
    const replacementLength = tail.length;
    const replaceEnd = composerSelectionEnd ?? currentChunkSource.length;
    const replaceStart = Math.max(0, replaceEnd - replacementLength);
    const newSource =
      currentChunkSource.slice(0, replaceStart) +
      itrans +
      currentChunkSource.slice(replaceEnd);
    const nextCaret = replaceStart + itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
  };

  const handleQuickInsert = (itrans: string) => {
    const start = composerSelectionStart ?? currentChunkSource.length;
    const end = composerSelectionEnd ?? start;
    const newSource =
      currentChunkSource.slice(0, start) +
      itrans +
      currentChunkSource.slice(end);
    const nextCaret = start + itrans.length;
    updateChunkSource(newSource, nextCaret, nextCaret, currentEditTarget);
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
  const showLexicalInHud = displaySettings.predictionLayout === 'footer';

  const showAnyDynamicHUD =
    showAlternatives || showCompletions || showSuggestions || (showLexicalSuggestions && showLexicalInHud);
  const showCharacterAssist = showAlternatives || showSuggestions || showCompletions;
  const showQuickReference = !showAnyDynamicHUD && !showLexicalSuggestions;


  return (
    <div
      className="w-full min-h-0 max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/55 px-3 py-2 md:max-h-[14vh]"
      data-testid="sticky-shortcut-hud"
    >
      {showQuickReference && (
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-hide">
          <span className="mr-1 shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Quick</span>
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {DEFAULT_SHORTCUTS.map((m, i) => (
              <button
                key={`def-${i}`}
                onClick={() => handleQuickInsert(m.itrans)} // Now functional
                className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 transition-all active:scale-95 hover:border-blue-300 hover:bg-blue-50"
              >
                <span className="text-lg font-serif text-slate-900 transition-transform group-hover:scale-110">{m.unicode}</span>
                <kbd className="text-[10px] font-mono font-bold tracking-tight text-blue-600 opacity-70">{m.itrans}</kbd>
              </button>
            ))}
          </div>
        </div>
      )}

      {showAnyDynamicHUD && (
        <>
          <div className="flex flex-col gap-2 py-1">
            {showLexicalSuggestions && showLexicalInHud && <WordPredictionTray variant="footer" />}

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
                        'group flex shrink-0 items-center gap-2 rounded-lg border py-1.5 pl-2 pr-3 transition-all active:scale-95',
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
                        'group flex shrink-0 items-center gap-2 rounded-lg border py-1.5 pl-2 pr-3 transition-all active:scale-95',
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
                      className="group flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-all active:scale-95 hover:border-blue-300 hover:bg-blue-50"
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
