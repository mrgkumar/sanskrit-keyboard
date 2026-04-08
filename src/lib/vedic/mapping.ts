export interface VedicMapping {
  itrans: string;
  unicode: string;
  name?: string;
  canonicalItrans?: string;
  isAlias?: boolean;
  preferredReverse?: boolean;
  requiresTokenBoundary?: boolean;
  category: 'consonant' | 'vowel' | 'mark' | 'vedic' | 'special' | 'number';
  subCategory?: string;
  isScholarly?: boolean;
}

const sortMappingTrie = (mappings: VedicMapping[]) =>
  [...mappings].sort((a, b) => b.itrans.length - a.itrans.length);

export type InputScheme = 'canonical-vedic' | 'baraha-compatible';
export type OutputScheme = 'canonical-vedic' | 'baraha-compatible' | 'sanskrit-tamil-precision';
export type OutputScript = 'roman' | 'devanagari' | 'tamil';
export type ComparisonOutputScript = 'off' | OutputScript;
export type RomanOutputStyle = 'canonical' | 'baraha';
export type TamilOutputStyle = 'precision';

export interface OutputTargetSettings {
  primaryOutputScript: OutputScript;
  comparisonOutputScript: ComparisonOutputScript;
  romanOutputStyle: RomanOutputStyle;
  tamilOutputStyle: TamilOutputStyle;
}

export const OUTPUT_TARGET_CONTROL_LABELS = {
  readAs: 'Read As',
  compare: 'Compare',
  primaryScript: 'Primary Script',
  compareWith: 'Compare With',
  romanStyle: 'Roman Style',
  tamilMode: 'Tamil Mode',
} as const;

export const OUTPUT_TARGET_VALUE_LABELS: Record<
  OutputScript | ComparisonOutputScript | RomanOutputStyle | TamilOutputStyle,
  string
> = {
  roman: 'Roman',
  devanagari: 'Devanagari',
  tamil: 'Tamil',
  off: 'Off',
  canonical: 'Canonical',
  baraha: 'Baraha',
  precision: 'Precision',
};

export const OUTPUT_TARGET_STYLE_OPTIONS = {
  roman: ['canonical', 'baraha'],
  tamil: ['precision'],
} as const satisfies {
  roman: RomanOutputStyle[];
  tamil: TamilOutputStyle[];
};

export const DEFAULT_OUTPUT_TARGET_SETTINGS: OutputTargetSettings = {
  primaryOutputScript: 'devanagari',
  comparisonOutputScript: 'tamil',
  romanOutputStyle: 'canonical',
  tamilOutputStyle: 'precision',
};

export const setPrimaryOutputScript = (
  settings: OutputTargetSettings,
  primaryOutputScript: OutputScript
): OutputTargetSettings => ({
  ...settings,
  primaryOutputScript,
});

export const setComparisonOutputScript = (
  settings: OutputTargetSettings,
  comparisonOutputScript: ComparisonOutputScript
): OutputTargetSettings => ({
  ...settings,
  comparisonOutputScript,
});

export const getOutputTargetQuickLabels = (settings: OutputTargetSettings) => ({
  readAs: `${OUTPUT_TARGET_CONTROL_LABELS.readAs}: ${
    OUTPUT_TARGET_VALUE_LABELS[settings.primaryOutputScript]
  }`,
  compare: `${OUTPUT_TARGET_CONTROL_LABELS.compare}: ${
    OUTPUT_TARGET_VALUE_LABELS[settings.comparisonOutputScript]
  }`,
});

export const getPrimaryCopyTargetDescriptor = (settings: OutputTargetSettings) => {
  if (settings.primaryOutputScript === 'roman') {
    const styleLabel = OUTPUT_TARGET_VALUE_LABELS[settings.romanOutputStyle];
    return {
      script: 'roman' as const,
      styleLabel,
      label: `Roman (${styleLabel})`,
      legacyOutputScheme:
        settings.romanOutputStyle === 'baraha'
          ? ('baraha-compatible' as const)
          : ('canonical-vedic' as const),
    };
  }

  if (settings.primaryOutputScript === 'tamil') {
    const styleLabel = OUTPUT_TARGET_VALUE_LABELS[settings.tamilOutputStyle];
    return {
      script: 'tamil' as const,
      styleLabel,
      label: `Tamil (${styleLabel})`,
      legacyOutputScheme: 'sanskrit-tamil-precision' as const,
    };
  }

  return {
    script: 'devanagari' as const,
    styleLabel: null,
    label: OUTPUT_TARGET_VALUE_LABELS.devanagari,
    legacyOutputScheme: null,
  };
};

export const getOutputTargetSettingsFromLegacyOutputScheme = (
  outputScheme: OutputScheme = 'canonical-vedic'
): OutputTargetSettings => {
  if (outputScheme === 'baraha-compatible') {
    return {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'roman',
      romanOutputStyle: 'baraha',
    };
  }

  if (outputScheme === 'sanskrit-tamil-precision') {
    return {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'tamil',
      tamilOutputStyle: 'precision',
    };
  }

  return {
    ...DEFAULT_OUTPUT_TARGET_SETTINGS,
    primaryOutputScript: 'roman',
    romanOutputStyle: 'canonical',
  };
};

export const normalizeOutputTargetSettings = (
  value?: Partial<OutputTargetSettings> & { outputScheme?: OutputScheme }
): OutputTargetSettings => {
  const hasAnyNewField =
    value?.primaryOutputScript !== undefined ||
    value?.comparisonOutputScript !== undefined ||
    value?.romanOutputStyle !== undefined ||
    value?.tamilOutputStyle !== undefined;

  if (!hasAnyNewField) {
    return getOutputTargetSettingsFromLegacyOutputScheme(value?.outputScheme);
  }

  return {
    primaryOutputScript:
      value?.primaryOutputScript ?? DEFAULT_OUTPUT_TARGET_SETTINGS.primaryOutputScript,
    comparisonOutputScript:
      value?.comparisonOutputScript ?? DEFAULT_OUTPUT_TARGET_SETTINGS.comparisonOutputScript,
    romanOutputStyle:
      value?.romanOutputStyle ?? DEFAULT_OUTPUT_TARGET_SETTINGS.romanOutputStyle,
    tamilOutputStyle: 'precision',
  };
};

export const resolveLegacyOutputSchemeBridge = (
  settings: OutputTargetSettings,
  _fallback: OutputScheme = 'canonical-vedic'
): OutputScheme => {
  void _fallback;
  const descriptor = getPrimaryCopyTargetDescriptor(settings);
  return descriptor.legacyOutputScheme ?? 'canonical-vedic';
};

export const OUTPUT_SCHEME_LABELS: Record<OutputScheme, string> = {
  'canonical-vedic': 'Canonical Vedic',
  'baraha-compatible': 'Baraha-compatible',
  'sanskrit-tamil-precision': 'Tamil Precision',
};

export const OUTPUT_SCHEME_UI_METADATA: Record<
  OutputScheme,
  { buttonTitle: string; buttonDescription: string }
> = {
  'canonical-vedic': {
    buttonTitle: 'Canonical Vedic Output',
    buttonDescription: 'Copies canonical source such as `R^i`, `kh`, `ch`, and `.a`.',
  },
  'baraha-compatible': {
    buttonTitle: 'Baraha-Compatible Output',
    buttonDescription: 'Copies compatible source such as `Ru`, `K`, `c`, `oum`, and `&` without changing internal storage.',
  },
  'sanskrit-tamil-precision': {
    buttonTitle: 'Tamil Precision Output',
    buttonDescription: 'Copies Sanskrit-in-Tamil precision forms such as `க³ீதா`, `அம்ரு¹த`, and `க³ுருஃ` without changing stored source.',
  },
};

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
  { itrans: 'kh', unicode: '\u0916\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'G', unicode: '\u0918\u094D', canonicalItrans: 'gh', isAlias: true, category: 'consonant' },
  { itrans: 'gh', unicode: '\u0918\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'ch', unicode: '\u091A\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'J', unicode: '\u091D\u094D', canonicalItrans: 'jh', isAlias: true, category: 'consonant' },
  { itrans: 'jh', unicode: '\u091D\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'Th', unicode: '\u0920\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'Dh', unicode: '\u0922\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'th', unicode: '\u0925\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'dh', unicode: '\u0927\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'P', unicode: '\u092b\u094D', canonicalItrans: 'ph', isAlias: true, category: 'consonant' },
  { itrans: 'ph', unicode: '\u092b\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'B', unicode: '\u092d\u094D', canonicalItrans: 'bh', isAlias: true, category: 'consonant' },
  { itrans: 'bh', unicode: '\u092d\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'sh', unicode: '\u0936\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: 'Sh', unicode: '\u0937\u094D', preferredReverse: true, category: 'consonant' },
  { itrans: '~g', unicode: '\u0919\u094D', canonicalItrans: '~N', isAlias: true, category: 'consonant' },
  { itrans: '~N', unicode: '\u0919\u094D', preferredReverse: true, name: 'velar nasal', category: 'consonant' },
  { itrans: '~j', unicode: '\u091E\u094D', canonicalItrans: '~n', isAlias: true, category: 'consonant' },
  { itrans: '~n', unicode: '\u091E\u094D', preferredReverse: true, name: 'palatal nasal', category: 'consonant' },
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
  { itrans: 'w', unicode: '\u0935\u094D', canonicalItrans: 'v', isAlias: true, category: 'consonant' },
  { itrans: 's', unicode: '\u0938\u094D', category: 'consonant' },
  { itrans: 'h', unicode: '\u0939\u094D', category: 'consonant' },
  { itrans: 'L', unicode: '\u0933\u094D', name: 'retroflex l', category: 'consonant' },
  { itrans: 'S', unicode: '\u0937\u094D', canonicalItrans: 'Sh', isAlias: true, category: 'consonant' },
  { itrans: '_R', unicode: '\u0931\u094D', preferredReverse: true, name: 'rra', category: 'consonant' },
  { itrans: '_f', unicode: '\u0929\u094D', preferredReverse: true, name: 'nnna', category: 'consonant' },
  { itrans: '_zh', unicode: '\u0934\u094D', preferredReverse: true, name: 'llla', category: 'consonant' },

  // Vowels
  { itrans: 'aa', unicode: '\u0906', category: 'vowel' },
  { itrans: 'A', unicode: '\u0906', category: 'vowel' },
  { itrans: 'ii', unicode: '\u0908', category: 'vowel' },
  { itrans: 'I', unicode: '\u0908', category: 'vowel' },
  { itrans: 'ee', unicode: '\u0908', canonicalItrans: 'ii', isAlias: true, category: 'vowel' },
  { itrans: 'uu', unicode: '\u090A', category: 'vowel' },
  { itrans: 'U', unicode: '\u090A', category: 'vowel' },
  { itrans: 'oo', unicode: '\u090A', canonicalItrans: 'uu', isAlias: true, category: 'vowel' },

  { itrans: 'RRi', unicode: '\u090B', category: 'vowel' },
  { itrans: 'Ru', unicode: '\u090B', canonicalItrans: 'RRi', isAlias: true, category: 'vowel' },
  { itrans: 'R^i', unicode: '\u090B', category: 'vowel' },
  { itrans: 'RRI', unicode: '\u0960', category: 'vowel' },
  { itrans: 'RU', unicode: '\u0960', canonicalItrans: 'RRI', isAlias: true, category: 'vowel' },
  { itrans: 'R^I', unicode: '\u0960', category: 'vowel' },
  { itrans: 'LLi', unicode: '\u090C', category: 'vowel' },
  { itrans: '~lu', unicode: '\u090C', canonicalItrans: 'LLi', isAlias: true, category: 'vowel' },
  { itrans: 'L^i', unicode: '\u090C', category: 'vowel' },
  { itrans: 'LLI', unicode: '\u0961', category: 'vowel' },
  { itrans: '~lU', unicode: '\u0961', canonicalItrans: 'LLI', isAlias: true, category: 'vowel' },
  { itrans: 'L^I', unicode: '\u0961', category: 'vowel' },
  { itrans: 'ai', unicode: '\u0910', preferredReverse: true, category: 'vowel' },
  { itrans: 'au', unicode: '\u0914', preferredReverse: true, category: 'vowel' },
  { itrans: 'ou', unicode: '\u0914', canonicalItrans: 'au', isAlias: true, category: 'vowel' },
  { itrans: 'a', unicode: '\u0905', preferredReverse: true, category: 'vowel' },
  { itrans: 'i', unicode: '\u0907', preferredReverse: true, category: 'vowel' },
  { itrans: 'u', unicode: '\u0909', preferredReverse: true, category: 'vowel' },
  { itrans: 'e', unicode: '\u090f', preferredReverse: true, category: 'vowel' },
  { itrans: 'o', unicode: '\u0913', preferredReverse: true, category: 'vowel' },
  { itrans: 'O', unicode: '\u0913', category: 'vowel' },
  { itrans: '.e', unicode: '\u090E', preferredReverse: true, category: 'vowel' },
  { itrans: '.o', unicode: '\u0912', preferredReverse: true, category: 'vowel' },
  { itrans: '.e', unicode: '\u0946', preferredReverse: true, category: 'mark' },
  { itrans: '.o', unicode: '\u094A', preferredReverse: true, category: 'mark' },


  // Vedic Marks
  { itrans: "'", unicode: '\u0951', name: 'svarita', category: 'vedic' },
  { itrans: "'", unicode: '\u0951', preferredReverse: true, name: 'svarita', category: 'vedic' },
  { itrans: "\_", unicode: '\u0952', name: 'anudatta', category: 'vedic' },
  { itrans: "_", unicode: '\u0952', preferredReverse: true, name: 'anudatta', category: 'vedic' },
  { itrans: "_M~_", unicode: '\u0952\uF156\u0952', category: 'vedic' },
  { itrans: "_M~M_", unicode: '\u0952\uF156\u0902\u0952', category: 'vedic' },
  { itrans: "_MM~_", unicode: '\u0952\uA8F3\u0952', category: 'vedic' },
  { itrans: "M~", unicode: '\uF156', category: 'mark' },
  { itrans: ".m", unicode: '\uE001', category: 'mark' },
  { itrans: ".mm", unicode: '\uE002', category: 'mark' },
  { itrans: ".N", unicode: '\u0901', preferredReverse: true, name: 'chandrabindu', category: 'mark' },
  { itrans: ".n", unicode: '\u0902', name: 'anusvara', category: 'mark' },
  { itrans: "M", unicode: '\u0902', preferredReverse: true, name: 'anusvara', category: 'mark' },
  { itrans: "MM", unicode: '\u0956', preferredReverse: true, name: 'Vedic anusvara', category: 'mark' },
  { itrans: ":", unicode: '\u0903', preferredReverse: true, name: 'visarga', category: 'mark' },
  { itrans: ".a", unicode: '\u093D', preferredReverse: true, name: 'avagraha', category: 'mark' },
  { itrans: '&', unicode: '\u093D', canonicalItrans: '.a', isAlias: true, category: 'mark' },
  { itrans: ":'", unicode: '\u0903\u200C\u0951', category: 'mark' },
  { itrans: ":_", unicode: '\u0903\u200C\u0952', category: 'mark' },
  { itrans: ":''", unicode: '\u0903\u200C\u1CDA\uF176', preferredReverse: true, category: 'mark' },
  { itrans: ':"', unicode: '\u0903\u200C\u1CDA\uF176', category: 'mark' },
  { itrans: '^z', unicode: '\u200C', preferredReverse: true, name: 'zwnj', category: 'special' },
  { itrans: '^Z', unicode: '\u200D', preferredReverse: true, name: 'zwj', category: 'special' },
  { itrans: "H_k", unicode: '\u1CF5', name: 'jihvamuliya', category: 'vedic' },
  { itrans: "H_p", unicode: '\u1CF6', name: 'upadhmaniya', category: 'vedic' },
  { itrans: "H^", unicode: '\u1CF2', category: 'vedic' },
  { itrans: "''", unicode: '\u1CDA\uF176', preferredReverse: true, name: 'double svarita', category: 'vedic' },
  { itrans: '"', unicode: '\u1CDA\uF176', name: 'double svarita', category: 'vedic' },
  { itrans: "'''", unicode: '\u1CDB', preferredReverse: true, name: 'triple svarita', category: 'vedic' },
  { itrans: "_M", unicode: '\u1CD4', category: 'vedic' },
  { itrans: "_K", unicode: '\u1CD0', category: 'vedic' },
  { itrans: "_P", unicode: '\u1CD2', category: 'vedic' },
  { itrans: "MM~", unicode: '\uA8F3', category: 'mark' },
  { itrans: "M^~", unicode: '\uA8F4', category: 'mark' },
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
  { itrans: "||", unicode: '\u0965', preferredReverse: true, category: 'special' },
  { itrans: "|", unicode: '\u0964', preferredReverse: true, category: 'special' },
  { itrans: "..", unicode: '\u0965', canonicalItrans: '||', isAlias: true, category: 'special' },
  { itrans: ".", unicode: '\u0964', canonicalItrans: '|', isAlias: true, category: 'special' },
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

  { itrans: '.N^', unicode: '\u0900', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.a-', unicode: '\u0904', category: 'vowel', isScholarly: true, subCategory: 'Short' },
  { itrans: '~e', unicode: '\u090D', category: 'vowel', isScholarly: true, subCategory: 'Candra' },
  { itrans: '~o', unicode: '\u0911', category: 'vowel', isScholarly: true, subCategory: 'Candra' },
  { itrans: '^oe', unicode: '\u093A', category: 'mark', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^ooe', unicode: '\u093B', category: 'mark', isScholarly: true, subCategory: 'Regional' },
  { itrans: '.#', unicode: '\u093C', category: 'mark', isScholarly: true, subCategory: 'Nukta' },
  { itrans: '~e=', unicode: '\u0945', category: 'mark', isScholarly: true, subCategory: 'Candra' },
  { itrans: '~o=', unicode: '\u0949', category: 'mark', isScholarly: true, subCategory: 'Candra' },
  { itrans: '^pm', unicode: '\u094E', category: 'mark', isScholarly: true, subCategory: 'Archaic' },
  { itrans: '^aw', unicode: '\u094F', category: 'mark', isScholarly: true, subCategory: 'Regional' },
  { itrans: '\u0060', unicode: '\u0953', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: "''", unicode: '\u0954', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '~E=', unicode: '\u0955', category: 'mark', isScholarly: true, subCategory: 'Candra' },
  { itrans: '^uue', unicode: '\u0957', category: 'mark', isScholarly: true, subCategory: 'Regional' },
  { itrans: 'q', unicode: '\u0958', category: 'consonant', isScholarly: false, subCategory: 'Nukta' },
  { itrans: 'khh', unicode: '\u0959', category: 'consonant', isScholarly: false, subCategory: 'Nukta' },
  { itrans: 'ghh', unicode: '\u095A', category: 'consonant', isScholarly: false, subCategory: 'Nukta' },
  { itrans: 'z', unicode: '\u095B', category: 'consonant', isScholarly: false, subCategory: 'Nukta' },
  { itrans: '.D', unicode: '\u095C', category: 'consonant', isScholarly: false, subCategory: 'Regional' },
  { itrans: '.rh', unicode: '\u095D', category: 'consonant', isScholarly: false, subCategory: 'Regional' },
  { itrans: 'f', unicode: '\u095E', category: 'consonant', isScholarly: false, subCategory: 'Nukta' },
  { itrans: 'Y', unicode: '\u095F', category: 'consonant', isScholarly: false, subCategory: 'Regional' },
  { itrans: '..', unicode: '\u0971', category: 'special', isScholarly: true, subCategory: 'Extended' },
  { itrans: '~A', unicode: '\u0972', category: 'vowel', isScholarly: true, subCategory: 'Candra' },
  { itrans: '^oe=', unicode: '\u0973', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^ooe=', unicode: '\u0974', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^aw=', unicode: '\u0975', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^ue', unicode: '\u0976', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^uue=', unicode: '\u0977', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '..jj', unicode: '\u0978', category: 'consonant', isScholarly: true, subCategory: 'Regional' },
  { itrans: 'z=', unicode: '\u0979', category: 'consonant', isScholarly: true, subCategory: 'Regional' },
  { itrans: '..g', unicode: '\u097A', category: 'consonant', isScholarly: true, subCategory: 'Sindhi' },
  { itrans: '..j', unicode: '\u097B', category: 'consonant', isScholarly: true, subCategory: 'Sindhi' },
  { itrans: '..D', unicode: '\u097C', category: 'consonant', isScholarly: true, subCategory: 'Sindhi' },
  { itrans: '..?', unicode: '\u097D', category: 'special', isScholarly: true, subCategory: 'Extended' },
  { itrans: '..b', unicode: '\u097E', category: 'consonant', isScholarly: true, subCategory: 'Sindhi' },
  { itrans: '..p', unicode: '\u097F', category: 'consonant', isScholarly: true, subCategory: 'Sindhi' },
  { itrans: '6=', unicode: '\uA8E6', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '8=', unicode: '\uA8E8', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '9=', unicode: '\uA8E9', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^a=', unicode: '\uA8EA', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^u=', unicode: '\uA8EB', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^ka=', unicode: '\uA8EC', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^na=', unicode: '\uA8ED', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^pa=', unicode: '\uA8EE', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^ra=', unicode: '\uA8EF', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^vi=', unicode: '\uA8F0', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^va=', unicode: '\uA8F1', category: 'vedic', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '._', unicode: '\uA8F2', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.v', unicode: '\uA8F3', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.m^', unicode: '\uA8F4', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.N3', unicode: '\uA8F5', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.N4', unicode: '\uA8F6', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '.Na', unicode: '\uA8F7', category: 'mark', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '++', unicode: '\uA8F8', category: 'special', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '==', unicode: '\uA8F9', category: 'special', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '^^', unicode: '\uA8FA', category: 'special', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '--', unicode: '\uA8FB', category: 'special', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '..sid', unicode: '\uA8FC', category: 'special', isScholarly: true, subCategory: 'Vedic' },
  { itrans: '..jom', unicode: '\uA8FD', category: 'special', isScholarly: true, subCategory: 'Jain' },
  { itrans: '^ay', unicode: '\uA8FE', category: 'vowel', isScholarly: true, subCategory: 'Regional' },
  { itrans: '^ay=', unicode: '\uA8FF', category: 'mark', isScholarly: true, subCategory: 'Regional' },];

export const TAMIL_MAPPINGS: VedicMapping[] = [
  // Vowels
  { itrans: 'a', unicode: '\u0B85', preferredReverse: true, category: 'vowel' },
  { itrans: 'A', unicode: '\u0B86', preferredReverse: true, category: 'vowel' },
  { itrans: 'i', unicode: '\u0B87', preferredReverse: true, category: 'vowel' },
  { itrans: 'I', unicode: '\u0B88', preferredReverse: true, category: 'vowel' },
  { itrans: 'u', unicode: '\u0B89', preferredReverse: true, category: 'vowel' },
  { itrans: 'U', unicode: '\u0B8A', preferredReverse: true, category: 'vowel' },
  { itrans: 'e', unicode: '\u0B8E', preferredReverse: true, category: 'vowel' },
  { itrans: 'E', unicode: '\u0B8F', preferredReverse: true, category: 'vowel' },
  { itrans: 'ai', unicode: '\u0B90', preferredReverse: true, category: 'vowel' },
  { itrans: 'o', unicode: '\u0B92', preferredReverse: true, category: 'vowel' },
  { itrans: 'O', unicode: '\u0B93', preferredReverse: true, category: 'vowel' },
  { itrans: 'au', unicode: '\u0B94', preferredReverse: true, category: 'vowel' },
  
  // Consonants
  { itrans: 'k', unicode: '\u0B95\u0BCD', category: 'consonant' },
  { itrans: 'g', unicode: '\u0B95\u0BCD', canonicalItrans: 'k', isAlias: true, category: 'consonant' },
  { itrans: 'kh', unicode: '\u0B95\u0BCD', canonicalItrans: 'k', isAlias: true, category: 'consonant' },
  { itrans: 'gh', unicode: '\u0B95\u0BCD', canonicalItrans: 'k', isAlias: true, category: 'consonant' },
  
  { itrans: 'c', unicode: '\u0B9A\u0BCD', category: 'consonant' },
  { itrans: 'ch', unicode: '\u0B9A\u0BCD', canonicalItrans: 'c', isAlias: true, category: 'consonant' },
  { itrans: 'j', unicode: '\u0B9C\u0BCD', category: 'consonant' },
  { itrans: 'jh', unicode: '\u0B9C\u0BCD', canonicalItrans: 'j', isAlias: true, category: 'consonant' },
  
  { itrans: 'T', unicode: '\u0B9F\u0BCD', category: 'consonant' },
  { itrans: 'D', unicode: '\u0B9F\u0BCD', canonicalItrans: 'T', isAlias: true, category: 'consonant' },
  { itrans: 'Th', unicode: '\u0B9F\u0BCD', canonicalItrans: 'T', isAlias: true, category: 'consonant' },
  { itrans: 'Dh', unicode: '\u0B9F\u0BCD', canonicalItrans: 'T', isAlias: true, category: 'consonant' },
  
  { itrans: 't', unicode: '\u0BA4\u0BCD', category: 'consonant' },
  { itrans: 'd', unicode: '\u0BA4\u0BCD', canonicalItrans: 't', isAlias: true, category: 'consonant' },
  { itrans: 'th', unicode: '\u0BA4\u0BCD', canonicalItrans: 't', isAlias: true, category: 'consonant' },
  { itrans: 'dh', unicode: '\u0BA4\u0BCD', canonicalItrans: 't', isAlias: true, category: 'consonant' },
  
  { itrans: 'p', unicode: '\u0BAA\u0BCD', category: 'consonant' },
  { itrans: 'b', unicode: '\u0BAA\u0BCD', canonicalItrans: 'p', isAlias: true, category: 'consonant' },
  { itrans: 'ph', unicode: '\u0BAA\u0BCD', canonicalItrans: 'p', isAlias: true, category: 'consonant' },
  { itrans: 'bh', unicode: '\u0BAA\u0BCD', canonicalItrans: 'p', isAlias: true, category: 'consonant' },
  
  { itrans: 'n', unicode: '\u0BA8\u0BCD', name: 'dental n', category: 'consonant' },
  { itrans: 'N', unicode: '\u0BA3\u0BCD', name: 'retroflex N', category: 'consonant' },
  { itrans: '~n', unicode: '\u0B9E\u0BCD', name: 'palatal n', category: 'consonant' },
  { itrans: '~N', unicode: '\u0B99\u0BCD', name: 'velar n', category: 'consonant' },
  { itrans: 'm', unicode: '\u0BAE\u0BCD', category: 'consonant' },
  
  { itrans: 'y', unicode: '\u0BAF\u0BCD', category: 'consonant' },
  { itrans: 'r', unicode: '\u0BB0\u0BCD', category: 'consonant' },
  { itrans: 'R', unicode: '\u0BB1\u0BCD', category: 'consonant' }, // Retroflex R (ற)
  { itrans: 'l', unicode: '\u0BB2\u0BCD', category: 'consonant' },
  { itrans: 'L', unicode: '\u0BB3\u0BCD', category: 'consonant' }, // Retroflex L (ள)
  { itrans: 'v', unicode: '\u0BB5\u0BCD', category: 'consonant' },
  
  { itrans: 's', unicode: '\u0BB8\u0BCD', category: 'consonant' },
  { itrans: 'S', unicode: '\u0BB7\u0BCD', category: 'consonant' },
  { itrans: 'sh', unicode: '\u0BB7\u0BCD', canonicalItrans: 'S', isAlias: true, category: 'consonant' },
  { itrans: 'h', unicode: '\u0BB9\u0BCD', category: 'consonant' },
  
  // Special Tamil letters for Sanskrit transliteration (Grantha)
  { itrans: 'ks', unicode: '\u0B95\u0BCD\u0BB7\u0BCD', name: 'ksha', category: 'special' },
  { itrans: 'j~n', unicode: '\u0B9C\u0BCD\u0B9E\u0BCD', name: 'jna', category: 'special' },

  // Marks
  { itrans: 'M', unicode: '\u0B82', preferredReverse: true, name: 'anusvara', category: 'mark' },
  { itrans: ':', unicode: '\u0B83', preferredReverse: true, name: 'visarga', category: 'mark' },
  { itrans: '^z', unicode: '\u200C', preferredReverse: true, name: 'zwnj', category: 'special' },
  { itrans: '^Z', unicode: '\u200D', preferredReverse: true, name: 'zwj', category: 'special' },
  { itrans: "'", unicode: "[']", preferredReverse: true, name: 'svarita', category: 'vedic' },
  { itrans: "_", unicode: "[_]", preferredReverse: true, name: 'anudatta', category: 'vedic' },
  { itrans: "''", unicode: "['']", preferredReverse: true, name: 'double svarita', category: 'vedic' },
  { itrans: "'''", unicode: "[''']", preferredReverse: true, name: 'triple svarita', category: 'vedic' },
  
  // Punctuation & Numbers
  { itrans: "||", unicode: '\u0BEF', preferredReverse: true, category: 'special' },
  { itrans: "|", unicode: '\u0BE9', preferredReverse: true, category: 'special' },
  { itrans: '0', unicode: '\u0BE6', category: 'number' },
  { itrans: '1', unicode: '\u0BE7', category: 'number' },
  { itrans: '2', unicode: '\u0BE8', category: 'number' },
  { itrans: '3', unicode: '\u0BE9', category: 'number' },
  { itrans: '4', unicode: '\u0BEA', category: 'number' },
  { itrans: '5', unicode: '\u0BEB', category: 'number' },
  { itrans: '6', unicode: '\u0BEC', category: 'number' },
  { itrans: '7', unicode: '\u0BED', category: 'number' },
  { itrans: '8', unicode: '\u0BEE', category: 'number' },
  { itrans: '9', unicode: '\u0BEF', category: 'number' },
];

let _MAPPING_TRIE_TAMIL: VedicMapping[] | null = null;
export const getMappingTrieTamil = () => {
  if (!_MAPPING_TRIE_TAMIL) {
    _MAPPING_TRIE_TAMIL = sortMappingTrie(TAMIL_MAPPINGS);
  }
  return _MAPPING_TRIE_TAMIL;
};

const BARAHA_CONFLICT_MAPPINGS: VedicMapping[] = [
  { itrans: 'c', unicode: '\u091A\u094D', canonicalItrans: 'ch', isAlias: true, category: 'consonant' },
];

export const getDisplayMappingsForScheme = (outputScript: OutputScript) => {
  if (outputScript === 'tamil') {
    return TAMIL_MAPPINGS;
  }
  return VEDIC_MAPPINGS;
};

let _MAPPING_TRIE: VedicMapping[] | null = null;
export const getMappingTrie = () => {
  if (!_MAPPING_TRIE) {
    _MAPPING_TRIE = sortMappingTrie(VEDIC_MAPPINGS);
  }
  return _MAPPING_TRIE;
};

let _BARAHA_COMPATIBLE_MAPPING_TRIE: VedicMapping[] | null = null;
export const getBarahaMappingTrie = () => {
  if (!_BARAHA_COMPATIBLE_MAPPING_TRIE) {
    _BARAHA_COMPATIBLE_MAPPING_TRIE = sortMappingTrie([
      ...VEDIC_MAPPINGS,
      ...BARAHA_CONFLICT_MAPPINGS,
    ]);
  }
  return _BARAHA_COMPATIBLE_MAPPING_TRIE;
};

export const getInputMappings = (inputScheme: InputScheme = 'canonical-vedic') =>
  inputScheme === 'baraha-compatible'
    ? getBarahaMappingTrie()
    : getMappingTrie();

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

export const getPreferredDisplayItrans = (itrans: string, mappings: VedicMapping[] = []) =>
  mappings.find((mapping) => mapping.itrans === itrans)?.canonicalItrans ?? itrans;

export const getDisplayMapping = (itrans: string, outputScript: OutputScript) => {
  const mappings = getDisplayMappingsForScheme(outputScript).filter((mapping) => !mapping.isAlias);
  const displayItrans = getPreferredDisplayItrans(itrans, mappings);
  return mappings.find((mapping) => mapping.itrans === displayItrans);
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
  '\u0905': '',
  '\u0906': '\u093e',
  '\u0907': '\u093f',
  '\u0908': '\u0940',
  '\u0909': '\u0941',
  '\u090a': '\u0942',
  '\u090b': '\u0943',
  '\u0960': '\u0944',
  '\u090c': '\u0962',
  '\u0961': '\u0963',
  '\u090e': '\u0946',
  '\u090f': '\u0947',
  '\u0910': '\u0948',
  '\u0912': '\u094a',
  '\u0913': '\u094b',
  '\u0914': '\u094c',
  '\u0904': '\u093a',
  '\u090d': '\u0945',
  '\u0911': '\u0949',
  '\u0972': '\u0945',
  '\u0973': '\u093a',
  '\u0974': '\u093b',
  '\u0975': '\u094f',
  '\u0976': '\u0956',
  '\u0977': '\u0957',
  '\ua8fe': '\ua8ff',
};