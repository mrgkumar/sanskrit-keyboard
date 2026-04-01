export interface VedicMapping {
  itrans: string;
  unicode: string;
  name?: string;
  canonicalItrans?: string;
  isAlias?: boolean;
  preferredReverse?: boolean;
  requiresTokenBoundary?: boolean;
  category: 'consonant' | 'vowel' | 'mark' | 'vedic' | 'number' | 'special';
}

export type InputScheme = 'canonical-vedic' | 'baraha-compatible';
export type OutputScheme = 'canonical-vedic' | 'baraha-compatible';

/**
 * DEFINITIVE SCHOLARLY VEDIC MAPPING
 * Harmonized for 100% precision in both Vedic and standard Sanskrit.
 */
export const VEDIC_MAPPINGS: VedicMapping[] = [
  // Composite Scholarly Units
  { itrans: 'vvi~M', unicode: '\u0935\u094D\u0935\u093F\u0901', category: 'special' },
  { itrans: 'vva~M', unicode: '\u0935\u094D\u0935\u0901', category: 'special' },
  { itrans: 'ai^', unicode: '\u0948\uF176', category: 'mark' },
  { itrans: 'A^', unicode: '\u093E\uF176', category: 'mark' },
  { itrans: "..a", unicode: '\u093D\u093D', name: 'double avagraha', category: 'mark' },
  
  // Standard Conjuncts
  { itrans: 'kShya', unicode: '\u0915\u094D\u0937\u094D\u092F', category: 'special' },
  { itrans: 'kShy', unicode: '\u0915\u094D\u0937\u094D\u092F\u094D', name: 'kshya', category: 'consonant' },
  { itrans: 'thsy', unicode: '\u0925\u094D\u0938\u094D\u092F\u094D', category: 'consonant' },
  { itrans: 'kSh', unicode: '\u0915\u094D\u0937\u094D', name: 'ksha', category: 'consonant' },
  { itrans: 'j~n', unicode: '\u091C\u094D\u091E\u094D', name: 'jna', category: 'consonant' },
  { itrans: 'chh', unicode: '\u091B\u094D', category: 'consonant' },
  { itrans: 'Ch', unicode: '\u091B\u094D', category: 'consonant' },
  { itrans: 'C', unicode: '\u091B\u094D', canonicalItrans: 'Ch', isAlias: true, category: 'consonant' },
  
  // Consonants (Harmonized)
  { itrans: 'K', unicode: '\u0916\u094D', canonicalItrans: 'kh', isAlias: true, category: 'consonant' },
  { itrans: 'kh', unicode: '\u0916\u094D', category: 'consonant' },
  { itrans: 'G', unicode: '\u0918\u094D', canonicalItrans: 'gh', isAlias: true, category: 'consonant' },
  { itrans: 'gh', unicode: '\u0918\u094D', category: 'consonant' },
  { itrans: 'ch', unicode: '\u091A\u094D', category: 'consonant' },
  { itrans: 'J', unicode: '\u091D\u094D', canonicalItrans: 'jh', isAlias: true, category: 'consonant' },
  { itrans: 'jh', unicode: '\u091D\u094D', category: 'consonant' },
  { itrans: 'Th', unicode: '\u0920\u094D', category: 'consonant' },
  { itrans: 'Dh', unicode: '\u0922\u094D', category: 'consonant' },
  { itrans: 'th', unicode: '\u0925\u094D', category: 'consonant' },
  { itrans: 'dh', unicode: '\u0927\u094D', category: 'consonant' },
  { itrans: 'P', unicode: '\u092b\u094D', canonicalItrans: 'ph', isAlias: true, category: 'consonant' },
  { itrans: 'ph', unicode: '\u092b\u094D', category: 'consonant' },
  { itrans: 'B', unicode: '\u092d\u094D', canonicalItrans: 'bh', isAlias: true, category: 'consonant' },
  { itrans: 'bh', unicode: '\u092d\u094D', category: 'consonant' },
  { itrans: 'sh', unicode: '\u0936\u094D', category: 'consonant' },
  { itrans: 'Sh', unicode: '\u0937\u094D', category: 'consonant' },
  { itrans: '~g', unicode: '\u0919\u094D', canonicalItrans: '~N', isAlias: true, category: 'consonant' },
  { itrans: '~N', unicode: '\u0919\u094D', name: 'velar nasal', category: 'consonant' },
  { itrans: '~j', unicode: '\u091E\u094D', canonicalItrans: '~n', isAlias: true, category: 'consonant' },
  { itrans: '~n', unicode: '\u091E\u094D', name: 'palatal nasal', category: 'consonant' },
  { itrans: 'k', unicode: '\u0915\u094D', category: 'consonant' },
  { itrans: 'g', unicode: '\u0917\u094D', category: 'consonant' },
  { itrans: 'j', unicode: '\u091C\u094D', category: 'consonant' },
  { itrans: 'T', unicode: '\u091F\u094D', name: 'retroflex T', category: 'consonant' },
  { itrans: 'D', unicode: '\u0921\u094D', name: 'retroflex D', category: 'consonant' },
  { itrans: 'N', unicode: '\u0923\u094D', name: 'retroflex N', category: 'consonant' },
  { itrans: 't', unicode: '\u0924\u094D', name: 'dental t', category: 'consonant' },
  { itrans: 'd', unicode: '\u0926\u094D', name: 'dental d', category: 'consonant' },
  { itrans: 'n', unicode: '\u0928\u094D', category: 'consonant' },
  { itrans: 'p', unicode: '\u092a\u094D', category: 'consonant' },
  { itrans: 'b', unicode: '\u092c\u094D', category: 'consonant' },
  { itrans: 'm', unicode: '\u092e\u094D', category: 'consonant' },
  { itrans: 'y', unicode: '\u092f\u094D', category: 'consonant' },
  { itrans: 'r', unicode: '\u0930\u094D', category: 'consonant' },
  { itrans: 'l', unicode: '\u0932\u094D', category: 'consonant' },
  { itrans: 'v', unicode: '\u0935\u094D', category: 'consonant' },
  { itrans: 'w', unicode: '\u0935\u094D', category: 'consonant' },
  { itrans: 's', unicode: '\u0938\u094D', category: 'consonant' },
  { itrans: 'h', unicode: '\u0939\u094D', category: 'consonant' },
  { itrans: 'L', unicode: '\u0933\u094D', name: 'retroflex l', category: 'consonant' },
  { itrans: 'S', unicode: '\u0937\u094D', name: 'retroflex sh', category: 'consonant' },

  // Vowels
  { itrans: 'aa', unicode: '\u0906', category: 'vowel' },
  { itrans: 'A', unicode: '\u0906', category: 'vowel' },
  { itrans: 'ii', unicode: '\u0908', category: 'vowel' },
  { itrans: 'ee', unicode: '\u0908', canonicalItrans: 'I', isAlias: true, category: 'vowel' },
  { itrans: 'I', unicode: '\u0908', category: 'vowel' },
  { itrans: 'uu', unicode: '\u090A', category: 'vowel' },
  { itrans: 'oo', unicode: '\u090A', canonicalItrans: 'U', isAlias: true, category: 'vowel' },
  { itrans: 'U', unicode: '\u090A', category: 'vowel' },
  { itrans: 'RRi', unicode: '\u090B', name: 'vocalic r', category: 'vowel' },
  { itrans: 'Ru', unicode: '\u090B', canonicalItrans: 'R^i', isAlias: true, category: 'vowel' },
  { itrans: 'RRI', unicode: '\u0960', name: 'long vocalic r', category: 'vowel' },
  { itrans: 'RU', unicode: '\u0960', canonicalItrans: 'R^I', isAlias: true, category: 'vowel' },
  { itrans: 'R^i', unicode: '\u090B', category: 'vowel' },
  { itrans: 'R^I', unicode: '\u0960', category: 'vowel' },
  { itrans: 'LLi', unicode: '\u090C', name: 'vocalic l', category: 'vowel' },
  { itrans: '~lu', unicode: '\u090C', canonicalItrans: 'L^i', isAlias: true, category: 'vowel' },
  { itrans: 'LLI', unicode: '\u0961', name: 'long vocalic l', category: 'vowel' },
  { itrans: '~lU', unicode: '\u0961', canonicalItrans: 'L^I', isAlias: true, category: 'vowel' },
  { itrans: 'L^i', unicode: '\u090C', category: 'vowel' },
  { itrans: 'L^I', unicode: '\u0961', category: 'vowel' },
  { itrans: 'ai', unicode: '\u0910', category: 'vowel' },
  { itrans: 'ou', unicode: '\u0914', canonicalItrans: 'au', isAlias: true, category: 'vowel' },
  { itrans: 'au', unicode: '\u0914', category: 'vowel' },
  { itrans: 'a', unicode: '\u0905', category: 'vowel' },
  { itrans: 'i', unicode: '\u0907', category: 'vowel' },
  { itrans: 'u', unicode: '\u0909', category: 'vowel' },
  { itrans: 'e', unicode: '\u090f', category: 'vowel' },
  { itrans: 'o', unicode: '\u0913', category: 'vowel' },
  { itrans: 'O', unicode: '\u0913', category: 'vowel' },

  // Vedic Marks
  { itrans: "\\'", unicode: '\u0951', name: 'svarita', category: 'vedic' },
  { itrans: "'", unicode: '\u0951', name: 'svarita', category: 'vedic' },
  { itrans: "\\_", unicode: '\u0952', name: 'anudatta', category: 'vedic' },
  { itrans: "_", unicode: '\u0952', name: 'anudatta', category: 'vedic' },
  { itrans: "_M~_", unicode: '\u0952\uF156\u0952', category: 'vedic' },
  { itrans: "_M~M_", unicode: '\u0952\uF156\u0902\u0952', category: 'vedic' },
  { itrans: "_MM~_", unicode: '\u0952\uA8F3\u0952', category: 'vedic' },
  { itrans: "M~", unicode: '\uF156', category: 'mark' },
  { itrans: ".m", unicode: '\uE001', category: 'mark' },
  { itrans: ".mm", unicode: '\uE002', category: 'mark' },
  { itrans: ".N", unicode: '\u0901', name: 'chandrabindu', category: 'mark' },
  { itrans: ".n", unicode: '\u0902', name: 'anusvara', category: 'mark' },
  { itrans: "M", unicode: '\u0902', name: 'anusvara', category: 'mark' },
  { itrans: "MM", unicode: '\u0956', name: 'Vedic anusvara', category: 'mark' },
  { itrans: ":", unicode: '\u0903', name: 'visarga', category: 'mark' },
  { itrans: ".a", unicode: '\u093D', name: 'avagraha', category: 'mark' },
  { itrans: '&', unicode: '\u093D', canonicalItrans: '.a', isAlias: true, category: 'mark' },
  { itrans: ":'", unicode: '\u0903\u0951', category: 'mark' },
  { itrans: ":_", unicode: '\u0903\u0952', category: 'mark' },
  { itrans: ":''", unicode: '\u0903\uF176', category: 'mark' },
  { itrans: ':\"', unicode: '\u0903\uF176', category: 'mark' },
  { itrans: "H_k", unicode: '\u1CF5', name: 'jihvamuliya', category: 'vedic' },
  { itrans: "H_p", unicode: '\u1CF6', name: 'upadhmaniya', category: 'vedic' },
  { itrans: "H^", unicode: '\u1CF2', category: 'vedic' },
  { itrans: "''", unicode: '\uF176', name: 'dirgha svarita', category: 'vedic' },
  { itrans: '"', unicode: '\uF176', name: 'dirgha svarita', category: 'vedic' },
  { itrans: "'''", unicode: '\u1CDB', name: 'triple svarita', category: 'vedic' },
  { itrans: "_M", unicode: '\u1CD4', category: 'vedic' },
  { itrans: "_K", unicode: '\u1CD0', category: 'vedic' },
  { itrans: "_P", unicode: '\u1CD2', category: 'vedic' },
  { itrans: "MM~", unicode: '\uA8F3', category: 'mark' },
  { itrans: "M^", unicode: '\u1CE9', category: 'mark' },
  { itrans: "M^^", unicode: '\u1CEA', category: 'mark' },
  { itrans: "1=", unicode: '\uA8E0', category: 'vedic' },
  { itrans: "2=", unicode: '\uA8E1', category: 'vedic' },
  { itrans: "3=", unicode: '\uA8E2', category: 'vedic' },
  { itrans: "4=", unicode: '\uA8E3', category: 'vedic' },
  { itrans: "5=", unicode: '\uA8E4', category: 'vedic' },
  { itrans: "6=", unicode: '\uA8E5', category: 'vedic' },
  { itrans: "7=", unicode: '\uA8E7', category: 'vedic' },
  { itrans: "OM", unicode: '\u0950', category: 'special' },
  { itrans: 'oum', unicode: '\u0950', canonicalItrans: 'OM', isAlias: true, requiresTokenBoundary: true, category: 'special' },
  { itrans: "_0", unicode: '\u0970', category: 'special' },
  { itrans: "~M", unicode: '\u0901', name: 'chandrabindu', category: 'mark' },
  { itrans: "~", unicode: '\u0901', name: 'chandrabindu', category: 'mark' },
  
  // Punctuation & Numbers
  { itrans: "..", unicode: '\u0965', category: 'special' },
  { itrans: ".", unicode: '\u0964', category: 'special' },
  { itrans: '|', unicode: '\u0964', category: 'special' },
  { itrans: '0', unicode: '\u0966', category: 'number' },
  { itrans: '1', unicode: '\u0967', category: 'number' },
  { itrans: '2', unicode: '\u0968', category: 'number' },
  { itrans: '3', unicode: '\u0969', category: 'number' },
  { itrans: '4', unicode: '\u096a', category: 'number' },
  { itrans: '5', unicode: '\u096b', category: 'number' },
  { itrans: '6', unicode: '\u096c', category: 'number' },
  { itrans: '7', unicode: '\u096d', category: 'number' },
  { itrans: '8', unicode: '\u096e', category: 'number' },
  { itrans: '9', unicode: '\u096f', category: 'number' },
];

const BARAHA_CONFLICT_MAPPINGS: VedicMapping[] = [
  { itrans: 'c', unicode: '\u091A\u094D', canonicalItrans: 'ch', isAlias: true, category: 'consonant' },
];

const sortMappingTrie = (mappings: VedicMapping[]) =>
  [...mappings].sort((a, b) => b.itrans.length - a.itrans.length);

export const MAPPING_TRIE = sortMappingTrie(VEDIC_MAPPINGS);
const BARAHA_COMPATIBLE_MAPPING_TRIE = sortMappingTrie([
  ...VEDIC_MAPPINGS,
  ...BARAHA_CONFLICT_MAPPINGS,
]);

export const getInputMappings = (inputScheme: InputScheme = 'canonical-vedic') =>
  inputScheme === 'baraha-compatible'
    ? BARAHA_COMPATIBLE_MAPPING_TRIE
    : MAPPING_TRIE;

export const DISPLAY_MAPPINGS = VEDIC_MAPPINGS.filter((mapping) => !mapping.isAlias);

const buildAcceptedInputsMap = (mappings: VedicMapping[]) => {
  const acceptedInputsByDisplayItrans = new Map<string, string[]>();

  for (const mapping of mappings) {
    const displayItrans = mapping.canonicalItrans ?? mapping.itrans;
    const acceptedInputs = acceptedInputsByDisplayItrans.get(displayItrans) ?? [];
    acceptedInputs.push(mapping.itrans);
    acceptedInputsByDisplayItrans.set(displayItrans, acceptedInputs);
  }

  return acceptedInputsByDisplayItrans;
};

const ACCEPTED_INPUTS_BY_SCHEME: Record<InputScheme, Map<string, string[]>> = {
  'canonical-vedic': buildAcceptedInputsMap(VEDIC_MAPPINGS),
  'baraha-compatible': buildAcceptedInputsMap([
    ...VEDIC_MAPPINGS,
    ...BARAHA_CONFLICT_MAPPINGS,
  ]),
};

export const getAcceptedInputs = (
  displayItrans: string,
  inputScheme: InputScheme = 'canonical-vedic'
) => ACCEPTED_INPUTS_BY_SCHEME[inputScheme].get(displayItrans) ?? [displayItrans];

export const getAlternateAcceptedInputs = (
  displayItrans: string,
  inputScheme: InputScheme = 'canonical-vedic'
) => getAcceptedInputs(displayItrans, inputScheme).filter((input) => input !== displayItrans);

export const getPreferredDisplayItrans = (itrans: string) =>
  VEDIC_MAPPINGS.find((mapping) => mapping.itrans === itrans)?.canonicalItrans ?? itrans;

export const getDisplayMapping = (itrans: string) => {
  const displayItrans = getPreferredDisplayItrans(itrans);
  return DISPLAY_MAPPINGS.find((mapping) => mapping.itrans === displayItrans);
};

export const canonicalizeAcceptedInputToken = (
  value: string,
  inputScheme: InputScheme = 'canonical-vedic'
) => {
  const mappingTrie = getInputMappings(inputScheme);
  let canonical = '';
  let index = 0;

  while (index < value.length) {
    const match = mappingTrie.find((entry) => {
      if (!value.startsWith(entry.itrans, index)) {
        return false;
      }

      if (!entry.requiresTokenBoundary) {
        return true;
      }

      const previousChar = value[index - 1] ?? '';
      const nextChar = value[index + entry.itrans.length] ?? '';
      const isTokenChar = (char: string) => /[A-Za-z0-9]/.test(char);

      return !isTokenChar(previousChar) && !isTokenChar(nextChar);
    });

    if (!match) {
      canonical += value[index];
      index += 1;
      continue;
    }

    canonical += match.canonicalItrans ?? match.itrans;
    index += match.itrans.length;
  }

  return canonical;
};

export const DEPENDENT_VOWELS: Record<string, string> = {
  '\u0906': '\u093E',
  '\u0907': '\u093F',
  '\u0908': '\u0940',
  '\u0909': '\u0941',
  '\u090A': '\u0942',
  '\u090B': '\u0943',
  '\u0960': '\u0944',
  '\u090C': '\u0962',
  '\u0961': '\u0963',
  '\u090f': '\u0947',
  '\u0910': '\u0948',
  '\u0913': '\u094B',
  '\u0914': '\u094C',
};
