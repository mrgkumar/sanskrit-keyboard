import React from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { getDisplayMappingsForScheme, getMappingTrie } from '@/lib/vedic/mapping';
import { clsx } from 'clsx';
import type { ChunkEditTarget } from '@/store/types';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';
import { ScriptText } from '@/components/ScriptText';

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
  marks: [':', 'M', '.n', '~', '.N'],
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
  'M': [':'], // Anusvara, Visarga
  ':': ['M'],
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

  // --- Phonetic Completions Logic ---
  let completions: { itrans: string; unicode: string; tail: string; }[] = [];
  let longestItransSuffix = '';

  // Find the longest valid ITRANS code that is a suffix of activeBuffer
  for (let len = activeBuffer.length; len > 0; len--) {
    const suffix = activeBuffer.slice(-len);
    if (getMappingTrie().some(m => m.itrans === suffix)) { // Check if it's a known ITRANS code
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
      const displayMappings = getDisplayMappingsForScheme(displaySettings.primaryOutputScript);
      completions = group
        .map((itrans: string) => {
          const mapping = displayMappings.find(m => m.itrans === itrans);
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

  const showCharacterAssist = showAlternatives || showSuggestions || showCompletions;


  return (
    <div
      className="w-full shrink-0 min-h-0 max-w-5xl overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:max-h-[14vh]"
      data-testid="sticky-shortcut-hud"
    >
      {(showLexicalSuggestions && showLexicalInHud) && <WordPredictionTray variant="footer" className="mb-2" />}

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
                <span className={clsx('text-xs font-bold -ml-1 mr-2 flex h-4 w-4 items-center justify-center rounded-full tabular-nums', i === selectedSuggestionIndex ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>{i + 1}</span>
                <div className={clsx('text-xl font-serif text-slate-900 transition-transform group-hover:scale-110', i === selectedSuggestionIndex && 'text-white')}>
                  <ScriptText 
                    script={displaySettings.primaryOutputScript} 
                    text={m.unicode}
                    sanskritFontPreset={displaySettings.sanskritFontPreset}
                    tamilFontPreset={displaySettings.tamilFontPreset}
                    className={i === selectedSuggestionIndex ? 'text-white' : 'text-slate-900'}
                  />
                </div>
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
                <span className={clsx('text-xs font-bold -ml-1 mr-2 flex h-4 w-4 items-center justify-center rounded-full tabular-nums', i === selectedSuggestionIndex ? 'bg-white/20' : 'bg-slate-100 text-slate-400')}>{i + 1}</span>
                <div className={clsx('text-xl font-serif text-slate-900 transition-transform group-hover:scale-110', i === selectedSuggestionIndex && 'text-white')}>
                  <ScriptText 
                    script={displaySettings.primaryOutputScript} 
                    text={m.unicode}
                    sanskritFontPreset={displaySettings.sanskritFontPreset}
                    tamilFontPreset={displaySettings.tamilFontPreset}
                    className={i === selectedSuggestionIndex ? 'text-white' : 'text-slate-900'}
                  />
                </div>
                <kbd className={clsx('text-[10px] font-mono font-bold tracking-tighter', i === selectedSuggestionIndex ? 'text-blue-100' : 'text-blue-600 opacity-60')}>{m.itrans}</kbd>
              </button>
            ))}

            {showCompletions && completions.map((m, i) => (
              <button
                key={`comp-${i}`}
                onClick={() => handleInsert(m.itrans, m.tail)}
                className="group flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 transition-all active:scale-95 hover:border-blue-300 hover:bg-blue-50"
              >
                <div className="text-xl font-serif text-slate-900 transition-transform group-hover:scale-110">
                  <ScriptText 
                    script={displaySettings.primaryOutputScript} 
                    text={m.unicode}
                    sanskritFontPreset={displaySettings.sanskritFontPreset}
                    tamilFontPreset={displaySettings.tamilFontPreset}
                  />
                </div>
                <kbd className="text-[10px] font-mono font-bold tracking-tighter text-blue-600 opacity-60">{m.itrans}</kbd>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
