// app/src/lib/vedic/utils.ts
import { VEDIC_MAPPINGS, MAPPING_TRIE, DEPENDENT_VOWELS } from './mapping.ts';
import type { VedicMapping } from './mapping.ts';

export interface CharConfidence {
  char: string;
  confidence: number;
  rationale?: string;
}

export interface TransliterationResult {
  unicode: string;
  confidences: CharConfidence[];
  sourceToTargetMap: number[];
  targetToSourceMap: number[];
}

const TRANSLITERATION_CACHE = new Map<string, TransliterationResult>();

export const transliterate = (itrans: string): TransliterationResult => {
  if (TRANSLITERATION_CACHE.has(itrans)) {
    return TRANSLITERATION_CACHE.get(itrans)!;
  }

  let unicode = '';
  const confidences: CharConfidence[] = [];
  const sourceToTargetMap: number[] = new Array(itrans.length).fill(0);
  const targetToSourceMap: number[] = [];
  
  let i = 0;
  let pendingNasalRemap: '~N' | '~n' | null = null;
  
  const matraMap: Record<string, string> = {
    '\u0905': '', '\u0906': 'ा', '\u0907': 'ि', '\u0908': 'ी',
    '\u0909': 'ु', '\u090A': 'ू', '\u090B': 'ृ', '\u0960': 'ॄ',
    '\u090C': 'ॢ', '\u0961': 'ॣ',
    '\u090f': 'े', '\u0910': 'ै', '\u0913': 'ो', '\u0914': 'ौ'
  };

  while (i < itrans.length) {
    if (itrans[i] === '/') {
      i++;
      continue;
    }

    let match: VedicMapping | null = null;
    for (const entry of MAPPING_TRIE) {
      if (itrans.startsWith(entry.itrans, i)) {
        match = entry;
        break;
      }
    }

    if (match) {
      if (pendingNasalRemap && (match.itrans === 'N' || match.itrans === 'n')) {
        const remapped = MAPPING_TRIE.find((entry) => entry.itrans === pendingNasalRemap);
        if (remapped) {
          match = { ...remapped, itrans: match.itrans };
        }
        pendingNasalRemap = null;
      } else if (pendingNasalRemap) {
        pendingNasalRemap = null;
      }

      const nextChar = itrans[i + match.itrans.length] ?? '';
      const prevInputChar = itrans[i - 1] ?? '';

      if ((match.itrans === 'LLi' || match.itrans === 'LLI') && i > 0) {
        const consonantalL = MAPPING_TRIE.find(
          (entry) => entry.itrans === 'L' && entry.category === 'consonant'
        );

        if (consonantalL) {
          match = consonantalL;
        }
      }

      if ((match.itrans === 'RRi' || match.itrans === 'RRI') && prevInputChar === 'r') {
        const replacement = match.unicode;
        const replChars = Array.from(replacement);
        const currentSourceIndex = i;
        const targetStart = unicode.length;

        replChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < match.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }

        replChars.forEach((c) =>
          confidences.push({ char: c, confidence: 1.0, rationale: `Explicit vowel after r: ${match!.itrans}` })
        );
        unicode += replacement;
        i += match.itrans.length;
        continue;
      }

      if (
        match.itrans === 'M~' &&
        /^(~N|~n|n|N|Ch|ch)/.test(itrans.slice(i + match.itrans.length))
      ) {
        if (itrans.startsWith('N', i + match.itrans.length)) {
          pendingNasalRemap = '~N';
        } else if (
          itrans.startsWith('n', i + match.itrans.length) ||
          itrans.startsWith('Ch', i + match.itrans.length) ||
          itrans.startsWith('ch', i + match.itrans.length)
        ) {
          pendingNasalRemap = '~n';
        }
        match = { ...match, unicode: '\u0902' };
      }

      if (
        match.itrans.endsWith('a') &&
        nextChar &&
        /[aAiIuUeEoORL]/.test(nextChar)
      ) {
        const consonantalAlternate = MAPPING_TRIE.find(
          (entry) =>
            entry.itrans === match!.itrans.slice(0, -1) &&
            entry.unicode === `${match!.unicode}\u094D`
        );

        if (consonantalAlternate) {
          match = consonantalAlternate;
        }
      }

      const resolvedMatch = match;
      const isVowel = resolvedMatch.category === 'vowel';
      const matraValues = Object.values(matraMap).filter(v => v !== '');
      const startsWithMatra = matraValues.some(v => resolvedMatch.unicode.startsWith(v));
      const currentSourceIndex = i;

      if (
        resolvedMatch.itrans === 'ai' &&
        unicode.endsWith('\u093E') &&
        prevInputChar !== '/'
      ) {
        const matra = '\u0948';
        const matraChars = Array.from(matra);
        const targetStart = unicode.length;

        matraChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }

        matraChars.forEach((c) =>
          confidences.push({ char: c, confidence: 1.0, rationale: `Aa+ai composite: ${resolvedMatch.itrans}` })
        );
        unicode += matra;
      } else if (
        resolvedMatch.itrans === 'o' &&
        unicode.endsWith('\u093E') &&
        prevInputChar !== '/'
      ) {
        const matra = '\u094B';
        const matraChars = Array.from(matra);
        const targetStart = unicode.length;

        matraChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }

        matraChars.forEach((c) =>
          confidences.push({ char: c, confidence: 1.0, rationale: `Aa+o composite: ${resolvedMatch.itrans}` })
        );
        unicode += matra;
      } else if (
        resolvedMatch.itrans === 'e' &&
        unicode.endsWith('\u0913') &&
        prevInputChar !== '/'
      ) {
        const matra = '\u0947';
        const matraChars = Array.from(matra);
        const targetStart = unicode.length;

        matraChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }

        matraChars.forEach((c) =>
          confidences.push({ char: c, confidence: 1.0, rationale: `O+e composite: ${resolvedMatch.itrans}` })
        );
        unicode += matra;
      } else if (
        (isVowel || startsWithMatra) &&
        unicode.endsWith('्') &&
        itrans[i - 1] !== '\u094D'
      ) {
        const matra = matraMap[resolvedMatch.unicode] !== undefined ? matraMap[resolvedMatch.unicode] : resolvedMatch.unicode;
        unicode = unicode.slice(0, -1) + matra;
        
        targetToSourceMap.pop();
        const matraChars = Array.from(matra);
        matraChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = unicode.length - matraChars.length;
        }

        if (confidences.length > 0) confidences.pop();
        matraChars.forEach(c => confidences.push({ char: c, confidence: 1.0, rationale: `Matra: ${resolvedMatch.itrans}` }));
      } else if (
        (isVowel || startsWithMatra) &&
        unicode.endsWith('\u093C') &&
        !unicode.endsWith('\u094D\u093C')
      ) {
        const matra = matraMap[resolvedMatch.unicode] !== undefined ? matraMap[resolvedMatch.unicode] : resolvedMatch.unicode;
        const matraChars = Array.from(matra);
        const targetStart = unicode.length;

        matraChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }

        matraChars.forEach(c => confidences.push({ char: c, confidence: 1.0, rationale: `Nukta matra: ${resolvedMatch.itrans}` }));
        unicode += matra;
      } else {
        const replacement = resolvedMatch.unicode;
        const replChars = Array.from(replacement);
        const targetStart = unicode.length;
        
        replChars.forEach(() => targetToSourceMap.push(currentSourceIndex));
        for (let m = 0; m < resolvedMatch.itrans.length; m++) {
          sourceToTargetMap[i + m] = targetStart;
        }
        
        replChars.forEach(c => confidences.push({ char: c, confidence: 1.0, rationale: `Match: ${resolvedMatch.itrans}` }));
        unicode += replacement;
      }
      i += resolvedMatch.itrans.length;
    } else if (itrans[i] === '\\' && i + 1 < itrans.length) {
      const literalChar = itrans[i + 1];
      sourceToTargetMap[i] = unicode.length;
      sourceToTargetMap[i + 1] = unicode.length;
      targetToSourceMap.push(i);
      unicode += literalChar;
      confidences.push({ char: literalChar, confidence: 1.0, rationale: 'Escaped character' });
      i += 2;
    } else {
      sourceToTargetMap[i] = unicode.length;
      targetToSourceMap.push(i);
      unicode += itrans[i];
      confidences.push({ char: itrans[i], confidence: 0.5, rationale: 'Raw fallback' });
      i++;
    }
  }

  const result = { unicode, confidences, sourceToTargetMap, targetToSourceMap };
  if (itrans.length > 0 && itrans.length < 50) {
     TRANSLITERATION_CACHE.set(itrans, result);
  }
  return result;
};


// Pre-compute reverse mappings for efficiency
interface ReverseMappingEntry {
  unicode: string;
  itrans: string;
  category: string;
}

const REVERSE_TRIE_MAP = new Map<string, { itrans: string; category: string }>();

const addReverse = (unicode: string, itrans: string, category: string, force = false) => {
  if (!unicode || !itrans) return;
  // If force is true, or we don't have this unicode, or the new itrans is shorter (preferred shortcut)
  if (force || !REVERSE_TRIE_MAP.has(unicode) || itrans.length < REVERSE_TRIE_MAP.get(unicode)!.itrans.length) {
    REVERSE_TRIE_MAP.set(unicode, { itrans, category });
  }
};

// 1. Base mappings from VEDIC_MAPPINGS
VEDIC_MAPPINGS.forEach(m => {
  addReverse(m.unicode, m.itrans, m.category);
  // Add bare consonant form (without virama) mapping to base itrans for the lookahead logic
  if (m.category === 'consonant' && m.unicode.endsWith('\u094D')) {
    const bare = m.unicode.slice(0, -1);
    if (bare) {
       addReverse(bare, m.itrans, 'consonant');
    }
  }
});

// 2. Matras from DEPENDENT_VOWELS
for (const [indep, matra] of Object.entries(DEPENDENT_VOWELS)) {
  const indepMapping = VEDIC_MAPPINGS.find(m => m.unicode === indep && m.category === 'vowel');
  if (indepMapping) {
    addReverse(matra, indepMapping.itrans, 'mark');
  }
}

const dependentVowelOverrides: Record<string, string> = {
  '\u0943': 'R^i',
  '\u0944': 'R^I',
  '\u0962': 'L^i',
  '\u0963': 'L^I',
};

for (const [uni, itrans] of Object.entries(dependentVowelOverrides)) {
  addReverse(uni, itrans, 'mark', true);
}

// 3. Requested shortcuts and essential vowels/symbols
const overrides: Record<string, string> = {
  '\u0951': "'",   // Svarita
  '\u0952': "_",   // Anudatta
  '\uF176': "''",  // Dirgha Svarita
  '\u0903': ":",   // Visarga
  '\u0905': "a",   // Independent a
  '\u0901': '.N',  // Canonical chandrabindu to avoid ~n/~N ambiguity in forward transliteration
  '\u0964': "|",   // Danda
  '\u0965': "||",  // Double Danda
  '\u0956': "MM",  // Vedic Anusvara
  '\u1CD6': "''",  // Normalize extended double-svarita style to dirgha-svarita input
};
for (const [uni, itrans] of Object.entries(overrides)) {
  addReverse(uni, itrans, 'special', true);
}

addReverse('\u0903\uF176', ":''", 'special', true);
addReverse('\u0952\uF156\u0952', '_M~_', 'special', true);

// Convert Map to sorted array for greedy matching
const REVERSE_MAPPING_TRIE: ReverseMappingEntry[] = Array.from(REVERSE_TRIE_MAP.entries())
  .map(([unicode, { itrans, category }]) => ({ unicode, itrans, category }))
  .sort((a, b) => b.unicode.length - a.unicode.length);

const DEPENDENT_VOWEL_SET = new Set(Object.values(DEPENDENT_VOWELS));
const INDEPENDENT_VOWEL_UNICODE_SET = new Set(
  VEDIC_MAPPINGS.filter((entry) => entry.category === 'vowel').map((entry) => entry.unicode)
);


export const detransliterate = (unicode: string): string => {
  let itrans = '';
  let i = 0;
  const unicodeChars = Array.from(unicode); // Handle surrogate pairs correctly
  let lastExplicitConsonantToken: string | null = null;

  while (i < unicodeChars.length) {
    let match: ReverseMappingEntry | null = null;
    
    // Try to match longest Unicode sequence first
    for (const entry of REVERSE_MAPPING_TRIE) {
      const entryChars = Array.from(entry.unicode);
      if (i + entryChars.length <= unicodeChars.length) {
        const sub = unicodeChars.slice(i, i + entryChars.length).join('');
        if (sub === entry.unicode) {
          match = entry;
          break;
        }
      }
    }

    if (match) {
      const matchLen = Array.from(match.unicode).length;
      
      // Specialized logic for consonants to handle implicit 'a' vs matra vs virama
      if (match.category === 'consonant' && !match.unicode.endsWith('\u094D')) {
        const nextIdx = i + matchLen;
        let nextMatch: ReverseMappingEntry | null = null;
        
        if (nextIdx < unicodeChars.length) {
          // Look ahead for virama or matra
          for (const entry of REVERSE_MAPPING_TRIE) {
            if (entry.unicode === '\u094D' || (entry.category === 'mark' && Object.values(DEPENDENT_VOWELS).includes(entry.unicode))) {
               const entryChars = Array.from(entry.unicode);
               const sub = unicodeChars.slice(nextIdx, nextIdx + entryChars.length).join('');
               if (sub === entry.unicode) {
                 nextMatch = entry;
                 break;
               }
            }
          }
        }

        if (nextMatch) {
          if (nextMatch.unicode === '\u094D') {
            // Consonant + Virama -> output base itrans only
            itrans += match.itrans;
            lastExplicitConsonantToken = match.itrans;
            i += matchLen + 1;
          } else {
            // Consonant + Matra -> output base itrans + matra itrans
            const needsClusterSeparator =
              i > 0 &&
              unicodeChars[i - 1] === '\u094D' &&
              lastExplicitConsonantToken !== null &&
              VEDIC_MAPPINGS.some((entry) => entry.itrans === `${lastExplicitConsonantToken}${match.itrans}`);

            if (needsClusterSeparator) {
              itrans += '/';
            }

            itrans += match.itrans + nextMatch.itrans;
            lastExplicitConsonantToken = null;
            i += matchLen + Array.from(nextMatch.unicode).length;
          }
        } else {
          // Consonant alone -> output base itrans + implicit 'a'
          const nextUnicodeChar = unicodeChars[nextIdx] ?? '';
          const needsClusterSeparator =
            i > 0 &&
            unicodeChars[i - 1] === '\u094D' &&
            lastExplicitConsonantToken !== null &&
            VEDIC_MAPPINGS.some((entry) => entry.itrans === `${lastExplicitConsonantToken}${match.itrans}`);
          const needsHiatusSeparator = INDEPENDENT_VOWEL_UNICODE_SET.has(nextUnicodeChar);

          if (needsClusterSeparator) {
            itrans += '/';
          }

          itrans += match.itrans + 'a';
          if (needsHiatusSeparator) {
            itrans += '/';
          }
          lastExplicitConsonantToken = null;
          i += matchLen;
        }
      } else {
        // Not a bare consonant, output itrans as-is
        const previousUnicodeChar = unicodeChars[i - 1] ?? '';
        const needsVowelSeparator =
          match.category === 'vowel' &&
          (INDEPENDENT_VOWEL_UNICODE_SET.has(previousUnicodeChar) || DEPENDENT_VOWEL_SET.has(previousUnicodeChar));

        if (needsVowelSeparator) {
          itrans += '/';
        }

        itrans += match.itrans;
        lastExplicitConsonantToken =
          match.category === 'consonant' && match.unicode.endsWith('\u094D') ? match.itrans : null;
        i += matchLen;
      }
    } else {
      // If no specific match, append char as-is
      itrans += unicodeChars[i];
      lastExplicitConsonantToken = null;
      i++;
    }
  }

  return itrans;
};
