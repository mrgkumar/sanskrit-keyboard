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
    selectedSuggestionIndex,
    getActiveChunkGroup,
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

  const showAnyDynamicHUD = showAlternatives || showCompletions || showSuggestions;


  return (
    <div className="flex items-center gap-3 overflow-x-auto h-16 w-full max-w-5xl px-4 scrollbar-hide">
      {!showAnyDynamicHUD && (
        <>
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
        </>
      )}

      {showAlternatives && (
        <>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mr-2 shrink-0">Alternatives:</span>
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {alternateSuggestions.map((m, i) => (
              <button
                key={`alt-${i}`}
                onClick={() => handleInsert(m.itrans, activeBuffer)}
                className={clsx(
                  "flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-lg transition-all shrink-0 active:scale-95 group",
                  i === selectedSuggestionIndex 
                    ? "bg-blue-600 text-white border-blue-500 shadow-lg" 
                    : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                )}
              >
                <span className={clsx("text-xs font-bold -ml-1 mr-2 tabular-nums w-4 h-4 rounded-full flex items-center justify-center", i === selectedSuggestionIndex ? "bg-white/20" : "bg-slate-100 text-slate-400")}>{i + 1}</span>
                <span className={clsx("text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform", i === selectedSuggestionIndex && "text-white")}>{m.unicode}</span>
                <kbd className={clsx("text-[10px] font-mono font-bold tracking-tighter", i === selectedSuggestionIndex ? "text-blue-100" : "text-blue-600 opacity-60")}>{m.itrans}</kbd>
              </button>
            ))}
          </div>
        </>
      )}

      {showSuggestions && (
        <>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mr-2 shrink-0">Suggestions:</span>
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {suggestions.map((m, i) => (
              <button
                key={`sug-${i}`}
                onClick={() => handleInsert(m.itrans, activeBuffer)}
                className={clsx(
                  "flex items-center gap-2 pl-2 pr-3 py-1.5 border rounded-lg transition-all shrink-0 active:scale-95 group",
                  i === selectedSuggestionIndex 
                    ? "bg-blue-600 text-white border-blue-500 shadow-lg" 
                    : "bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50"
                )}
              >
                <span className={clsx("text-xs font-bold -ml-1 mr-2 tabular-nums w-4 h-4 rounded-full flex items-center justify-center", i === selectedSuggestionIndex ? "bg-white/20" : "bg-slate-100 text-slate-400")}>{i + 1}</span>
                <span className={clsx("text-xl font-serif text-slate-900 group-hover:scale-110 transition-transform", i === selectedSuggestionIndex && "text-white")}>{m.unicode}</span>
                <kbd className={clsx("text-[10px] font-mono font-bold tracking-tighter", i === selectedSuggestionIndex ? "text-blue-100" : "text-blue-600 opacity-60")}>{m.itrans}</kbd>
              </button>
            ))}
          </div>
        </>
      )}

      {showCompletions && (
        <>
          <div className="w-px h-6 bg-slate-200 mx-4 shrink-0" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter mr-2 shrink-0">Similar Sounds:</span>
          <div className="flex items-center gap-2 overflow-x-auto py-2">
            {completions.map((m, i) => (
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
        </>
      )}
    </div>
  );
};
