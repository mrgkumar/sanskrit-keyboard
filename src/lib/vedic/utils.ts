// app/src/lib/vedic/utils.ts
import { VEDIC_MAPPINGS, DEPENDENT_VOWELS, getInputMappings } from './mapping.ts';
import type { InputScheme, OutputScript, OutputTargetSettings, OutputScheme, VedicMapping } from './mapping.ts';
import { canonicalizeAcceptedInputToken, getPrimaryCopyTargetDescriptor } from './mapping.ts';

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

interface TransliterationOptions {
  inputScheme?: InputScheme;
}

interface OutputFormattingOptions {
  outputScheme?: OutputScheme;
  tamilPrecisionAsciiFallback?: boolean;
}

interface DetransliterationOptions {
  outputScheme?: OutputScheme;
}

export type TamilReverseInputKind =
  | 'tamil-precision'
  | 'plain-tamil'
  | 'baraha-tamil'
  | 'malformed-precision'
  | 'mixed-ambiguous';

export interface TamilReverseSuccessResult {
  status: 'success';
  inputKind: 'tamil-precision';
  canonicalRoman: string;
  barahaRoman?: string;
}

export interface TamilReverseRejectedResult {
  status: 'rejected';
  inputKind: Exclude<TamilReverseInputKind, 'tamil-precision'>;
  reason: string;
  originalText: string;
}

export type TamilReverseResult = TamilReverseSuccessResult | TamilReverseRejectedResult;

export interface ReverseTamilInputOptions {
  inputMode: 'tamil-precision';
  outputMode: 'canonical' | 'baraha';
}

export interface TamilPrecisionToken {
  token: string;
}

const TRANSLITERATION_CACHE = new Map<string, TransliterationResult>();
const TRANSLITERATION_CACHE_MAX = 50000;
const BARAHA_OUTPUT_OVERRIDES: Array<[string, string]> = [
  ['R^i', 'Ru'],
  ['R^I', 'RU'],
  ['RRi', 'Ru'],
  ['RRI', 'RU'],
  ['L^i', '~lu'],
  ['L^I', '~lU'],
  ['LLi', '~lu'],
  ['LLI', '~lU'],
  ['kh', 'K'],
  ['gh', 'G'],
  ['ch', 'c'],
  ['Ch', 'C'],
  ['jh', 'J'],
  ['ph', 'P'],
  ['bh', 'B'],
  ['I', 'ee'],
  ['U', 'oo'],
  ['au', 'ou'],
  ['OM', 'oum'],
  ['.a', '&'],
  ['~N', '~g'],
  ['~n', '~j'],
];
const BARAHA_OUTPUT_TOKENS = [...BARAHA_OUTPUT_OVERRIDES]
  .sort((a, b) => b[0].length - a[0].length);
const DEVANAGARI_TO_TAMIL_PULLI = '\u0BCD';
const TAMIL_PRECISION_PULLI = '\u0BCD';
const TAMIL_PRECISION_MARKERS = {
  aspiratedVoiceless: { rich: '²', ascii: '^2' },
  voicedUnaspirated: { rich: '³', ascii: '^3' },
  voicedAspirated: { rich: '⁴', ascii: '^4' },
} as const;
const DEVANAGARI_INDEPENDENT_VOWELS: Record<string, string> = {
  '\u0905': 'அ',
  '\u0906': 'ஆ',
  '\u0907': 'இ',
  '\u0908': 'ஈ',
  '\u0909': 'உ',
  '\u090A': 'ஊ',
  '\u090B': 'ரு¹',
  '\u0960': 'ரூ¹',
  '\u090C': 'லு¹',
  '\u0961': 'லூ¹',
  '\u090E': 'எ',
  '\u090F': 'ஏ',
  '\u0910': 'ஐ',
  '\u0912': 'ஒ',
  '\u0913': 'ஓ',
  '\u0914': 'ஔ',
};
const DEVANAGARI_DEPENDENT_VOWELS_TO_TAMIL: Record<string, string> = {
  '\u093E': 'ா',
  '\u093F': 'ி',
  '\u0940': 'ீ',
  '\u0941': 'ு',
  '\u0942': 'ூ',
  '\u0946': 'ெ',
  '\u0947': 'ே',
  '\u0948': 'ை',
  '\u094A': 'ொ',
  '\u094B': 'ோ',
  '\u094C': 'ௌ',
};
const DEVANAGARI_DEPENDENT_VOCALICS_TO_TAMIL: Record<string, string> = {
  '\u0943': '்ரு¹',
  '\u0944': '்ரூ¹',
  '\u0962': '்லு¹',
  '\u0963': '்லூ¹',
};
const DEVANAGARI_CONSONANTS_TO_TAMIL: Record<string, string> = {
  '\u0915': 'க',
  '\u0916': 'க²',
  '\u0917': 'க³',
  '\u0918': 'க⁴',
  '\u0919': 'ங',
  '\u091A': 'ச',
  '\u091B': 'ச²',
  '\u091C': 'ஜ',
  '\u091D': 'ஜ²',
  '\u091E': 'ஞ',
  '\u091F': 'ட',
  '\u0920': 'ட²',
  '\u0921': 'ட³',
  '\u0922': 'ட⁴',
  '\u0923': 'ண',
  '\u0924': 'த',
  '\u0925': 'த²',
  '\u0926': 'த³',
  '\u0927': 'த⁴',
  '\u0928': 'ந',
  '\u0929': 'ன',
  '\u092A': 'ப',
  '\u092B': 'ப²',
  '\u092C': 'ப³',
  '\u092D': 'ப⁴',
  '\u092E': 'ம',
  '\u092F': 'ய',
  '\u0930': 'ர',

  '\u0931': 'ற',
  '\u0932': 'ல',
  '\u0933': 'ள',
  '\u0934': 'ழ',
  '\u0935': 'வ',
  '\u0936': 'ஶ',
  '\u0937': 'ஷ',
  '\u0938': 'ஸ',
  '\u0939': 'ஹ',
};
const TAMIL_PRECISION_INDEPENDENT_VOWELS_TO_CANONICAL: Record<string, string> = {
  'ரூ¹': 'R^I',
  'லூ¹': 'L^I',
  'ரு¹': 'R^i',
  'லு¹': 'L^i',
  'அ': 'a',
  'ஆ': 'A',
  'இ': 'i',
  'ஈ': 'I',
  'உ': 'u',
  'ஊ': 'U',
  'எ': '.e',
  'ஏ': 'e',
  'ஐ': 'ai',
  'ஒ': '.o',
  'ஓ': 'o',
  'ஔ': 'au',
};
const TAMIL_PRECISION_DEPENDENT_VOWELS_TO_CANONICAL: Record<string, string> = {
  'ா': 'A',
  'ி': 'i',
  'ீ': 'I',
  'ு': 'u',
  'ூ': 'U',
  'ெ': '.e',
  'ே': 'e',
  'ை': 'ai',
  'ொ': '.o',
  'ோ': 'o',
  'ௌ': 'au',
};
const TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL: Record<string, string> = {
  '்ரூ¹': 'R^I',
  '்லூ¹': 'L^I',
  '்ரு¹': 'R^i',
  '்லு¹': 'L^i',
};
const TAMIL_PRECISION_CONSONANTS_TO_CANONICAL: Record<string, string> = {
  'க்ஷ': 'kSh',
  'க²': 'kh',
  'க³': 'g',
  'க⁴': 'gh',
  'ச²': 'Ch',
  'ஜ²': 'jh',
  'ட²': 'Th',
  'ட³': 'D',
  'ட⁴': 'Dh',
  'த²': 'th',
  'த³': 'd',
  'த⁴': 'dh',
  'ப²': 'ph',
  'ப³': 'b',
  'ப⁴': 'bh',
  'க': 'k',
  'ங': '~N',
  'ச': 'ch',
  'ஜ': 'j',
  'ஞ': '~n',
  'ட': 'T',
  'ண': 'N',
  'த': 't',
  'ந': 'n',
  'ப': 'p',
  'ம': 'm',
  'ய': 'y',
  'ர': 'r',
  'ற': '_R',
  'ல': 'l',
  'ள': 'L',
  'ன': 'n',
  'ழ': '_zh',
  'வ': 'v',
  'ஶ': 'sh',
  'ஷ': 'Sh',
  'ஸ': 's',
  'ஹ': 'h',
};
const TAMIL_PRECISION_ASCII_FALLBACKS: Array<[string, string]> = [
  ['ரூ<R>', 'ரூ¹'],
  ['லூ<L>', 'லூ¹'],
  ['ரு<R>', 'ரு¹'],
  ['லு<L>', 'லு¹'],
];
const TAMIL_PRECISION_ASCII_SUPERSCRIPT_PATTERN = /([கசஜடதப])\^([234])/gu;
const TAMIL_PRECISION_AMBIGUOUS_PLAIN_VOCALIC_PATTERN = /(^|[\s().,?!-])(ரு|ரூ|லு|லூ)(?=$|[\s().,?!-])/u;
const TAMIL_SCRIPT_PATTERN = /\p{Script=Tamil}/u;
const TAMIL_PRECISION_SIGNAL_PATTERN = /[¹²³⁴ஜஶஷஸஹஂ:॒॑᳚ऽ।॥]/u;
const TAMIL_REVERSE_STRUCTURAL_PRECISION_SIGNAL_PATTERN = /(?:[¹²³⁴]|\^2|\^3|\^4|<R>|<L>)/u;
const TAMIL_REVERSE_BARAHA_SIGNAL_PATTERN = /(?:\^\^|~~|~#|~\$|Rs)/u;
const TAMIL_REVERSE_MALFORMED_PRECISION_SIGNAL_PATTERN = /(?:\^(?![234])|<R(?!>)|<L(?!>))/u;
const TAMIL_PRECISION_INDEPENDENT_TOKENS = Object.keys(TAMIL_PRECISION_INDEPENDENT_VOWELS_TO_CANONICAL)
  .sort((a, b) => b.length - a.length);
const TAMIL_PRECISION_SPECIAL_TOKENS = ['॑', '॒', '᳚', '\uA8F4'];
const TAMIL_PRECISION_DEPENDENT_VOCALIC_TOKENS = Object.keys(TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL)
  .sort((a, b) => b.length - a.length);
const TAMIL_PRECISION_CONSONANT_TOKENS = Object.keys(TAMIL_PRECISION_CONSONANTS_TO_CANONICAL)
  .sort((a, b) => b.length - a.length);
const TAMIL_PRECISION_PUNCTUATION_PATTERN = /[().,?!-]/u;

export const normalizeTamilPrecisionDisplayText = (text: string) => {
  let normalized = text.replaceAll('ஂ', 'ம்');
  normalized = normalized.replaceAll('ँ', '');
  normalized = normalized.replaceAll('', '᳚');

  // A medial dental ந followed by a Vedic tone mark and then another Tamil letter
  // should display as the more natural medial ன form in the Tamil precision view.
  normalized = normalized.replace(
    /([\p{Script=Tamil}])ந([॒॑᳚]+)/gu,
    (_match, previous: string, marks: string) => `${previous}ன${marks}`,
  );

  // Move Sanskrit nasalization onto the following cluster, matching the Vignanam-style Tamil pages.
  normalized = normalized.replace(
    /([\p{Script=Tamil}])([ँं])([\p{Mark}]*)([\p{Letter}][\p{Letter}\p{Mark}]*)/gu,
    (_match, base: string, _nasal: string, marks: string, nextCluster: string) => `${base}${marks}${nextCluster}ம்`
  );

  // When a Vedic accent trails Tamil anusvara/nasalization, render the accent before the visible `ம்`
  // so the marker stays attached to the preceding akshara.
  normalized = normalized.replace(
    /([\p{Script=Tamil}\p{Mark}]+)(ம்)([॒॑]+)/gu,
    '$1$3$2'
  );

  normalized = normalized.replace(
    /([\p{Script=Tamil}])([¹²³⁴])([ாிீுூேொோைௌ]+)([॒॑᳚]+)/gu,
    '$1$3$4$2',
  );

  normalized = normalized.replace(/([\p{Script=Tamil}]+)([¹²³⁴])(்)/gu, '$1்$2');
  normalized = normalized.replace(/([\p{Script=Tamil}]+)([¹²³⁴])([ாிீுூேொோைௌ]+)/gu, '$1$3$2');
  normalized = normalized.replace(/([\p{Script=Tamil}\p{Mark}]+)([¹²³⁴])([॒॑᳚]+)/gu, '$1$3$2');

  return normalized.replaceAll('ஞ்ஜ', 'ஜ');
};

const normalizeTamilPrecisionInput = (value: string) => {
  let normalized = value;

  for (const [fallback, rich] of TAMIL_PRECISION_ASCII_FALLBACKS) {
    normalized = normalized.replaceAll(fallback, rich);
  }

  normalized = normalized.replace(
    /([\p{Script=Tamil}]+)్\^([234])/gu,
    (_match, base: string, marker: string) => {
      if (marker === '2') {
        return `${base}்${TAMIL_PRECISION_MARKERS.aspiratedVoiceless.rich}`;
      }
      if (marker === '3') {
        return `${base}்${TAMIL_PRECISION_MARKERS.voicedUnaspirated.rich}`;
      }
      return `${base}்${TAMIL_PRECISION_MARKERS.voicedAspirated.rich}`;
    },
  );

  normalized = normalized.replace(/([\p{Script=Tamil}]+)்([²³⁴]|\^[234])/gu, '$1$2்');
  normalized = normalized.replace(
    /([\p{Script=Tamil}])([ாிீுூேொோைௌ]+)([॒॑᳚]*)([²³⁴]+|\^[234]+)/gu,
    '$1$4$2$3',
  );
  normalized = normalized.replace(/([\p{Script=Tamil}])([॒॑᳚]+)([²³⁴]+|\^[234]+)/gu, '$1$3$2');

  return normalized.replace(
    TAMIL_PRECISION_ASCII_SUPERSCRIPT_PATTERN,
    (_match, base: string, marker: string) => {
      if (marker === '2') {
        return `${base}${TAMIL_PRECISION_MARKERS.aspiratedVoiceless.rich}`;
      }
      if (marker === '3') {
        return `${base}${TAMIL_PRECISION_MARKERS.voicedUnaspirated.rich}`;
      }
      return `${base}${TAMIL_PRECISION_MARKERS.voicedAspirated.rich}`;
    },
  );
};

const hasTamilPrecisionSignal = (value: string) =>
  value.includes('<R>') ||
  value.includes('<L>') ||
  /(?:\^2|\^3|\^4)/u.test(value) ||
  TAMIL_PRECISION_SIGNAL_PATTERN.test(value);

const isAtomicPlainTamilPrecisionForm = (value: string) => {
  if (TAMIL_PRECISION_INDEPENDENT_TOKENS.includes(value)) {
    return true;
  }

  if (value === 'ஂ' || value === 'ஃ') {
    return true;
  }

  const consonant = TAMIL_PRECISION_CONSONANT_TOKENS.find((token) => value.startsWith(token));
  if (!consonant) {
    return false;
  }

  const remainder = value.slice(consonant.length);
  if (remainder === '') {
    return true;
  }

  if (remainder === TAMIL_PRECISION_PULLI) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_DEPENDENT_VOWELS_TO_CANONICAL, remainder)) {
    return true;
  }

  return TAMIL_PRECISION_DEPENDENT_VOCALIC_TOKENS.includes(remainder);
};

const matchLongestTamilPrecisionToken = (source: string, index: number, tokens: string[]) =>
  tokens.find((token) => source.startsWith(token, index)) ?? null;

const renderTamilPrecisionToken = (token: string, asciiFallback: boolean) => {
  if (!asciiFallback) {
    return token;
  }

  return token
    .replaceAll('²', TAMIL_PRECISION_MARKERS.aspiratedVoiceless.ascii)
    .replaceAll('³', TAMIL_PRECISION_MARKERS.voicedUnaspirated.ascii)
    .replaceAll('⁴', TAMIL_PRECISION_MARKERS.voicedAspirated.ascii)
    .replaceAll('ரு¹', 'ரு<R>')
    .replaceAll('ரூ¹', 'ரூ<R>')
    .replaceAll('லு¹', 'லு<L>')
    .replaceAll('லூ¹', 'லூ<L>');
};

const splitTamilPrecisionRenderedConsonant = (token: string, asciiFallback: boolean) => {
  if (asciiFallback) {
    if (token.endsWith('^2')) {
      return { base: token.slice(0, -2), marker: '^2' };
    }

    if (token.endsWith('^3')) {
      return { base: token.slice(0, -2), marker: '^3' };
    }

    if (token.endsWith('^4')) {
      return { base: token.slice(0, -2), marker: '^4' };
    }

    return { base: token, marker: '' };
  }

  if (token.endsWith('²')) {
    return { base: token.slice(0, -1), marker: '²' };
  }

  if (token.endsWith('³')) {
    return { base: token.slice(0, -1), marker: '³' };
  }

  if (token.endsWith('⁴')) {
    return { base: token.slice(0, -1), marker: '⁴' };
  }

  return { base: token, marker: '' };
};

const formatTamilPrecisionSource = (itrans: string, asciiFallback: boolean) => {
  const canonicalSource = canonicalizeAcceptedInputToken(itrans);
  const unicode = transliterate(canonicalSource).unicode;
  let formatted = '';

  for (let index = 0; index < unicode.length; index += 1) {
    const current = unicode[index];
    const next = unicode[index + 1] ?? '';

    const independentVowel = DEVANAGARI_INDEPENDENT_VOWELS[current];
    if (independentVowel) {
      formatted += renderTamilPrecisionToken(independentVowel, asciiFallback);
      continue;
    }

    const consonant = DEVANAGARI_CONSONANTS_TO_TAMIL[current];
    if (consonant) {
      const renderedConsonant = renderTamilPrecisionToken(consonant, asciiFallback);
      const { base: consonantBase, marker: consonantMarker } = splitTamilPrecisionRenderedConsonant(
        renderedConsonant,
        asciiFallback,
      );

      if (next === '\u094D') {
        formatted += `${consonantBase}${DEVANAGARI_TO_TAMIL_PULLI}${consonantMarker}`;
        index += 1;
        continue;
      }

      const dependentVocalic = DEVANAGARI_DEPENDENT_VOCALICS_TO_TAMIL[next];
      if (dependentVocalic) {
        formatted += `${consonantBase}${consonantMarker}${renderTamilPrecisionToken(dependentVocalic, asciiFallback)}`;
        index += 1;
        continue;
      }

      const dependentVowel = DEVANAGARI_DEPENDENT_VOWELS_TO_TAMIL[next];
      if (dependentVowel) {
        formatted += `${consonantBase}${dependentVowel}${consonantMarker}`;
        index += 1;
        continue;
      }

      formatted += renderedConsonant;
      continue;
    }

    if (current === '\u0902' || current === '\u0901') {
      const isEnd = index === unicode.length - 1 || /[\s().,?!-।॥]/.test(unicode[index + 1] ?? '');
      formatted += isEnd ? 'ம்' : 'ஂ';
      continue;
    }

    if (current === '\u0903') {
      formatted += ':';
      continue;
    }

    if (current === '\uA8F4') {
      formatted += current;
      continue;
    }

    if (current === '\u0950') {
      formatted += 'ஓம்';
      continue;
    }

    formatted += current;
  }

  return formatted;
};

const isTokenChar = (char: string) => /[A-Za-z0-9]/.test(char);

const matchesInputEntryAt = (source: string, index: number, entry: VedicMapping) => {
  if (!source.startsWith(entry.itrans, index)) {
    return false;
  }

  if (!entry.requiresTokenBoundary) {
    return true;
  }

  const previousChar = source[index - 1] ?? '';
  const nextChar = source[index + entry.itrans.length] ?? '';
  return !isTokenChar(previousChar) && !isTokenChar(nextChar);
};

export const formatSourceForOutput = (
  itrans: string,
  options?: OutputFormattingOptions
): string => {
  const outputScheme = options?.outputScheme ?? 'canonical-vedic';
  if (outputScheme === 'canonical-vedic' || !itrans) {
    return itrans;
  }

  if (outputScheme === 'sanskrit-tamil-precision') {
    return formatTamilPrecisionSource(itrans, options?.tamilPrecisionAsciiFallback ?? false);
  }

  let formatted = '';
  let index = 0;

  while (index < itrans.length) {
    const match = BARAHA_OUTPUT_TOKENS.find(([canonical]) => itrans.startsWith(canonical, index));

    if (!match) {
      formatted += itrans[index];
      index += 1;
      continue;
    }

    formatted += match[1];
    index += match[0].length;
  }

  return formatted;
};

export const formatSourceForPrimaryOutput = (
  itrans: string,
  settings: OutputTargetSettings,
  options?: Pick<OutputFormattingOptions, 'tamilPrecisionAsciiFallback'>
): string => {
  return formatSourceForScript(itrans, settings.primaryOutputScript, settings, options);
};

export const formatSourceForScript = (
  itrans: string,
  script: OutputScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: Pick<OutputFormattingOptions, 'tamilPrecisionAsciiFallback'>
): string => {
  if (!itrans) {
    return itrans;
  }

  if (script === 'devanagari') {
    return transliterate(itrans).unicode;
  }

  return formatSourceForOutput(itrans, {
    outputScheme:
      script === 'roman'
        ? settings.romanOutputStyle === 'baraha'
          ? 'baraha-compatible'
          : 'canonical-vedic'
        : settings.tamilOutputStyle === 'precision'
          ? 'sanskrit-tamil-precision'
          : 'canonical-vedic',
    tamilPrecisionAsciiFallback: options?.tamilPrecisionAsciiFallback,
  });
};

export const getCopySourceControlText = (settings: OutputTargetSettings) => {
  const descriptor = getPrimaryCopyTargetDescriptor(settings);

  return {
    ariaLabel: `Copy ITRANS source as ${descriptor.label}`,
    title: `Copy ITRANS as ${descriptor.label}`,
    targetLabel: descriptor.label,
  };
};

export const parseTamilPrecisionToCanonical = (value: string): string | null => {
  const tokens = tokenizeTamilPrecisionInput(value);
  if (!tokens) {
    return null;
  }

  const normalized = tokens.map(({ token }) => token).join('');
  if (TAMIL_PRECISION_AMBIGUOUS_PLAIN_VOCALIC_PATTERN.test(normalized)) {
    return null;
  }

  let canonical = '';
  let index = 0;

  while (index < tokens.length) {
    const currentToken = tokens[index]?.token;
    if (!currentToken) {
      break;
    }

    if (Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_INDEPENDENT_VOWELS_TO_CANONICAL, currentToken)) {
      canonical += TAMIL_PRECISION_INDEPENDENT_VOWELS_TO_CANONICAL[currentToken];
      index += 1;
      continue;
    }

    if (currentToken === '॑') {
    canonical += "'";
    index += 1;
    continue;
  }

  if (currentToken === '॒') {
    canonical += '_';
    index += 1;
    continue;
  }

  if (currentToken === '᳚') {
    canonical += "''";
    index += 1;
    continue;
  }

  if (currentToken === '\uA8F4') {
    canonical += 'M^~';
    index += 1;
    continue;
  }

  if (currentToken === 'ऽ') {

    const nextToken = tokens[index + 1]?.token ?? '';
    if (nextToken === 'ऽ') {
      canonical += '..a';
      index += 2;
    } else {
      canonical += '.a';
      index += 1;
    }
    continue;
  }

  if (currentToken === '।') {
    canonical += '|';
    index += 1;
    continue;
  }

  if (currentToken === '॥') {
    canonical += '||';
    index += 1;
    continue;
  }
  if (Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_CONSONANTS_TO_CANONICAL, currentToken)) {

      const consonantSource = TAMIL_PRECISION_CONSONANTS_TO_CANONICAL[currentToken];
      const nextToken = tokens[index + 1]?.token ?? '';

      if (Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL, nextToken)) {
        canonical += consonantSource + TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL[nextToken];
        index += 2;
        continue;
      }

      if (nextToken === TAMIL_PRECISION_PULLI) {
        const nextNextToken = tokens[index + 2]?.token ?? '';
        // If it's a pulli followed by a vocalic, it's m + R^i
        if (Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL, nextNextToken)) {
           canonical += consonantSource + TAMIL_PRECISION_DEPENDENT_VOCALICS_TO_CANONICAL[nextNextToken];
           index += 3;
           continue;
        }
        canonical += consonantSource;
        index += 2;
        continue;
      }

      const dependentVowel = TAMIL_PRECISION_DEPENDENT_VOWELS_TO_CANONICAL[nextToken];
      if (dependentVowel) {
        canonical += consonantSource + dependentVowel;
        index += 2;
        continue;
      }

      canonical += `${consonantSource}a`;
      index += 1;
      continue;
    }

    if (currentToken === 'ஂ') {
      canonical += 'M';
      index += 1;
      continue;
    }

    if (currentToken === ':') {
      canonical += ':';
      index += 1;
      continue;
    }

    if (/\s/u.test(currentToken) || TAMIL_PRECISION_PUNCTUATION_PATTERN.test(currentToken)) {
      canonical += currentToken;
      index += 1;
      continue;
    }

    return null;
  }

  return canonical;
};

export const tokenizeTamilPrecisionInput = (value: string): TamilPrecisionToken[] | null => {
  const normalized = normalizeTamilPrecisionInput(value);
  if (!hasTamilPrecisionSignal(value) && !isAtomicPlainTamilPrecisionForm(normalized)) {
    return null;
  }

  const tokens: TamilPrecisionToken[] = [];
  let index = 0;

  while (index < normalized.length) {
    const independent = matchLongestTamilPrecisionToken(normalized, index, TAMIL_PRECISION_INDEPENDENT_TOKENS);
    if (independent) {
      tokens.push({ token: independent });
      index += independent.length;
      continue;
    }

    const special = matchLongestTamilPrecisionToken(normalized, index, TAMIL_PRECISION_SPECIAL_TOKENS);
    if (special) {
      tokens.push({ token: special });
      index += special.length;
      continue;
    }

    const consonant = matchLongestTamilPrecisionToken(normalized, index, TAMIL_PRECISION_CONSONANT_TOKENS);
    if (consonant) {
      tokens.push({ token: consonant });
      index += consonant.length;
      continue;
    }

    const dependentVocalic = matchLongestTamilPrecisionToken(normalized, index, TAMIL_PRECISION_DEPENDENT_VOCALIC_TOKENS);
    if (dependentVocalic) {
      tokens.push({ token: dependentVocalic });
      index += dependentVocalic.length;
      continue;
    }

    const current = normalized[index];
    if (
      current === TAMIL_PRECISION_PULLI ||
      Object.prototype.hasOwnProperty.call(TAMIL_PRECISION_DEPENDENT_VOWELS_TO_CANONICAL, current) ||
      current === 'ஂ' ||
      current === ':' ||
      current === 'ऽ' ||
      current === '।' ||
      current === '॥' ||
      /\s/u.test(current) ||
      TAMIL_PRECISION_PUNCTUATION_PATTERN.test(current)
    ) {
      tokens.push({ token: current });
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
};

const getTamilReverseRejectionReason = (
  inputKind: Exclude<TamilReverseInputKind, 'tamil-precision'>,
) => {
  switch (inputKind) {
    case 'plain-tamil':
      return 'Input is Tamil script but does not contain the frozen Tamil Precision distinctions required for exact Sanskrit recovery.';
    case 'baraha-tamil':
      return 'Input appears to use Baraha Tamil control syntax, which phase 1 does not support as an exact reverse parser target.';
    case 'malformed-precision':
      return 'Input looks like Tamil Precision but contains incomplete or malformed precision markers.';
    case 'mixed-ambiguous':
      return 'Input mixes precise and ambiguous Tamil forms, so the parser cannot recover exact Sanskrit safely.';
  }
};

const classifyTamilReverseInput = (
  value: string,
): Exclude<TamilReverseInputKind, 'tamil-precision'> => {
  const normalized = normalizeTamilPrecisionInput(value);
  const hasTamilScript = TAMIL_SCRIPT_PATTERN.test(value);
  const hasBarahaSignal = TAMIL_REVERSE_BARAHA_SIGNAL_PATTERN.test(value);
  const hasMalformedPrecisionSignal = TAMIL_REVERSE_MALFORMED_PRECISION_SIGNAL_PATTERN.test(value);
  const hasPrecisionSignal = hasTamilPrecisionSignal(value);
  const hasStructuralPrecisionSignal = TAMIL_REVERSE_STRUCTURAL_PRECISION_SIGNAL_PATTERN.test(value);
  const hasAmbiguousPlainVocalic = TAMIL_PRECISION_AMBIGUOUS_PLAIN_VOCALIC_PATTERN.test(normalized);
  const hasMixedTamilSegments = hasStructuralPrecisionSignal && hasTamilScript && /[\s().,?!-]/u.test(normalized);

  if (hasBarahaSignal) {
    return 'baraha-tamil';
  }

  if ((hasStructuralPrecisionSignal && hasAmbiguousPlainVocalic) || hasMixedTamilSegments) {
    return 'mixed-ambiguous';
  }

  if (hasMalformedPrecisionSignal || hasStructuralPrecisionSignal || (hasPrecisionSignal && !hasTamilScript)) {
    return 'malformed-precision';
  }

  if (hasTamilScript) {
    return 'plain-tamil';
  }

  return 'mixed-ambiguous';
};

export const reverseTamilInput = (
  value: string,
  options: ReverseTamilInputOptions,
): TamilReverseResult => {
  if (options.inputMode !== 'tamil-precision') {
    return {
      status: 'rejected',
      inputKind: 'mixed-ambiguous',
      reason: getTamilReverseRejectionReason('mixed-ambiguous'),
      originalText: value,
    };
  }

  const canonicalRoman = parseTamilPrecisionToCanonical(value);
  if (canonicalRoman !== null) {
    return {
      status: 'success',
      inputKind: 'tamil-precision',
      canonicalRoman,
      ...(options.outputMode === 'baraha'
        ? {
            barahaRoman: formatSourceForOutput(canonicalRoman, { outputScheme: 'baraha-compatible' }),
          }
        : {}),
    };
  }

  const inputKind = classifyTamilReverseInput(value);
  return {
    status: 'rejected',
    inputKind,
    reason: getTamilReverseRejectionReason(inputKind),
    originalText: value,
  };
};

/**
 * Normalizes marker sequences for scholarly consistency.
 * Specifically, it ensures that Vedic markers (', _, '', ") appear BEFORE 
 * the visarga (:) even if typed or pasted in the reverse order.
 */
export const normalizeMarkerSequences = (itrans: string): string => {
  // Pattern: Visarga (:) followed by one or more Vedic markers (', _, '', ")
  // Match : followed by one or more of these markers and swap them.
  // Note: we handle double markers like '' or "" too.
  return itrans.replace(/:(['"_=]+)/g, '$1:');
};

export const transliterate = (
  itrans: string,
  options?: TransliterationOptions
): TransliterationResult => {
  const inputScheme = options?.inputScheme ?? 'canonical-vedic';
  const cacheKey = `${inputScheme}::${itrans}`;
  if (TRANSLITERATION_CACHE.has(cacheKey)) {
    return TRANSLITERATION_CACHE.get(cacheKey)!;
  }
  const mappingTrie = getInputMappings(inputScheme);

  let unicode = '';
  const confidences: CharConfidence[] = [];
  const sourceToTargetMap: number[] = new Array(itrans.length).fill(0);
  const targetToSourceMap: number[] = [];
  
  let i = 0;
  const itransBuffer = itrans;
  let pendingNasalRemap: '~N' | '~n' | null = null;
  
  const matraMap: Record<string, string> = {
    '\u0905': '', '\u0906': 'ा', '\u0907': 'ि', '\u0908': 'ी',
    '\u0909': 'ु', '\u090A': 'ू', '\u090B': 'ृ', '\u0960': 'ॄ',
    '\u090C': 'ॢ', '\u0961': 'ॣ',
    '\u090E': 'ॆ', '\u090F': 'े', '\u0910': 'ै', '\u0912': 'ॊ', '\u0913': 'ो', '\u0914': 'ौ'
  };

  while (i < itransBuffer.length) {
    if (itransBuffer[i] === '/') {
      i++;
      continue;
    }

    let match: VedicMapping | null = null;
    for (const entry of mappingTrie) {
      if (matchesInputEntryAt(itransBuffer, i, entry)) {
        match = entry;
        break;
      }
    }

    if (match) {
      if (pendingNasalRemap && (match.itrans === 'N' || match.itrans === 'n')) {
        const remapped = mappingTrie.find((entry) => entry.itrans === pendingNasalRemap);
        if (remapped) {
          match = { ...remapped, itrans: match.itrans };
        }
        pendingNasalRemap = null;
      } else if (pendingNasalRemap) {
        pendingNasalRemap = null;
      }

      const nextChar = itransBuffer[i + match.itrans.length] ?? '';
      const prevInputChar = itransBuffer[i - 1] ?? '';

      if ((match.itrans === 'LLi' || match.itrans === 'LLI') && i > 0) {
        const consonantalL = mappingTrie.find(
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
        /^(~N|~n|n|N|Ch|ch)/.test(itransBuffer.slice(i + match.itrans.length))
      ) {
        if (itransBuffer.startsWith('N', i + match.itrans.length)) {
          pendingNasalRemap = '~N';
        } else if (
          itransBuffer.startsWith('n', i + match.itrans.length) ||
          itransBuffer.startsWith('Ch', i + match.itrans.length) ||
          itransBuffer.startsWith('ch', i + match.itrans.length)
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
        const consonantalAlternate = mappingTrie.find(
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
        itransBuffer[i - 1] !== '\u094D'
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
    } else if (itransBuffer[i] === '\\' && i + 1 < itransBuffer.length) {
      const literalChar = itransBuffer[i + 1];
      sourceToTargetMap[i] = unicode.length;
      sourceToTargetMap[i + 1] = unicode.length;
      targetToSourceMap.push(i);
      unicode += literalChar;
      confidences.push({ char: literalChar, confidence: 1.0, rationale: 'Escaped character' });
      i += 2;
    } else {
      sourceToTargetMap[i] = unicode.length;
      targetToSourceMap.push(i);
      unicode += itransBuffer[i];
      confidences.push({ char: itransBuffer[i], confidence: 0.5, rationale: 'Raw fallback' });
      i++;
    }
  }

  const result = { unicode, confidences, sourceToTargetMap, targetToSourceMap };
  if (itrans.length > 0 && itrans.length < 50) {
    if (TRANSLITERATION_CACHE.size >= TRANSLITERATION_CACHE_MAX) {
      TRANSLITERATION_CACHE.clear();
    }

    TRANSLITERATION_CACHE.set(cacheKey, result);
  }
  return result;
};


// Pre-compute reverse mappings for efficiency
interface ReverseMappingEntry {
  unicode: string;
  itrans: string;
  category: string;
}

const REVERSE_TRIE_MAP = new Map<string, { itrans: string; category: string; priority: number }>();

const getReversePriority = (mapping: Pick<VedicMapping, 'isAlias' | 'preferredReverse'>) => {
  if (mapping.preferredReverse) {
    return 3;
  }
  if (!mapping.isAlias) {
    return 2;
  }
  return 1;
};

const getPreferredMatraSourceMapping = (unicode: string) => {
  const matches = VEDIC_MAPPINGS.filter(
    (mapping) => mapping.unicode === unicode && mapping.category === 'vowel'
  );
  if (matches.length === 0) return undefined;
  
  const preferred = matches.find(m => m.preferredReverse);
  if (preferred) return preferred;
  
  const nonAlias = matches.filter(m => !m.isAlias);
  if (nonAlias.length > 0) {
    return nonAlias.sort((a, b) => a.itrans.length - b.itrans.length)[0];
  }
  
  return matches.sort((a, b) => a.itrans.length - b.itrans.length)[0];
};

const addReverse = (
  unicode: string,
  itrans: string,
  category: string,
  options?: { force?: boolean; priority?: number }
) => {
  if (!unicode || !itrans) return;
  const force = options?.force ?? false;
  const priority = options?.priority ?? 0;
  const existing = REVERSE_TRIE_MAP.get(unicode);
  if (
    force ||
    !existing ||
    priority > existing.priority ||
    (priority === existing.priority && itrans.length < existing.itrans.length)
  ) {
    REVERSE_TRIE_MAP.set(unicode, { itrans, category, priority });
  }
};

// 1. Base mappings from VEDIC_MAPPINGS
VEDIC_MAPPINGS.forEach(m => {
  addReverse(m.unicode, m.itrans, m.category, { priority: getReversePriority(m) });
  // Add bare consonant form (without virama) mapping to base itrans for the lookahead logic
  if (m.category === 'consonant' && m.unicode.endsWith('\u094D')) {
    const bare = m.unicode.slice(0, -1);
    if (bare) {
       addReverse(bare, m.itrans, 'consonant', { priority: getReversePriority(m) });
    }
  }
});

// 2. Matras from DEPENDENT_VOWELS
for (const [indep, matra] of Object.entries(DEPENDENT_VOWELS)) {
  const indepMapping = getPreferredMatraSourceMapping(indep);
  if (indepMapping) {
    addReverse(matra, indepMapping.itrans, 'mark', { priority: getReversePriority(indepMapping) });
  }
}

const dependentVowelOverrides: Record<string, string> = {
  '\u0943': 'R^i',
  '\u0944': 'R^I',
  '\u0962': 'L^i',
  '\u0963': 'L^I',
};

for (const [uni, itrans] of Object.entries(dependentVowelOverrides)) {
  addReverse(uni, itrans, 'mark', { force: true });
}

// 3. Requested shortcuts and essential vowels/symbols
const overrides: Record<string, string> = {
  '\u0951': "'",   // Svarita
  '\u0952': "_",   // Anudatta
  '\uF176': "''",  // Dirgha Svarita
  '\uF186': "1=",  // Legacy Samaveda private-use accent form
  '\uF187': "2=",  // Legacy Samaveda private-use accent form
  '\uF188': "3=",  // Legacy Samaveda private-use accent form
  '\uF196': "6=",  // Legacy Samaveda private-use accent form
  '\u0903': ":",   // Visarga
  '\u0905': "a",   // Independent a
  '\u0901': '.N',  // Canonical chandrabindu to avoid ~n/~N ambiguity in forward transliteration
  '\u200C': '^z',  // Zero width non-joiner
  '\u200D': '^Z',  // Zero width joiner
  '\u0964': "|",   // Danda
  '\u0965': "||",  // Double Danda
  '\u0956': "MM",  // Vedic Anusvara
  '\uA8F3': "MM~", // Distinct Vedic anusvara variant used in corpus samples
  '\u1CD6': "''",  // Normalize extended double-svarita style to dirgha-svarita input
  '\u1CDA': "''",  // Vedic double svarita
};
for (const [uni, itrans] of Object.entries(overrides)) {
  addReverse(uni, itrans, 'special', { force: true });
}

addReverse('\u0903\uF176', ":''", 'special', { force: true });
addReverse('\u0952\uF156\u0952', '_M~_', 'special', { force: true });
addReverse('\u0952\uF156\u0902\u0952', '_M~M_', 'special', { force: true });
addReverse('\u0952\uA8F3\u0952', '_MM~_', 'special', { force: true });

// Convert Map to sorted array for greedy matching
let _REVERSE_MAPPING_TRIE: ReverseMappingEntry[] | null = null;
const getReverseMappingTrie = () => {
  if (!_REVERSE_MAPPING_TRIE) {
    _REVERSE_MAPPING_TRIE = Array.from(REVERSE_TRIE_MAP.entries())
      .map(([unicode, { itrans, category }]) => ({ unicode, itrans, category }))
      .sort((a, b) => b.unicode.length - a.unicode.length);
  }
  return _REVERSE_MAPPING_TRIE;
};

const DEPENDENT_VOWEL_SET = new Set(Object.values(DEPENDENT_VOWELS));
const INDEPENDENT_VOWEL_UNICODE_SET = new Set(
  VEDIC_MAPPINGS.filter((entry) => entry.category === 'vowel').map((entry) => entry.unicode)
);
const HIATUS_IGNORABLE_PATTERN = /[\u0951\u0952\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]/u;

const getNextSignificantUnicodeChar = (chars: string[], startIndex: number) => {
  for (let index = startIndex; index < chars.length; index++) {
    const value = chars[index];
    if (!HIATUS_IGNORABLE_PATTERN.test(value)) {
      return value;
    }
  }

  return '';
};

const getPreviousSignificantUnicodeChar = (chars: string[], startIndex: number) => {
  for (let index = startIndex; index >= 0; index--) {
    const value = chars[index];
    if (!HIATUS_IGNORABLE_PATTERN.test(value)) {
      return value;
    }
  }

  return '';
};

export const canonicalizeDevanagariPaste = (unicode: string) => detransliterate(unicode);


export const detransliterate = (
  unicode: string,
  options?: DetransliterationOptions
): string => {
  let itrans = '';
  let i = 0;
  const unicodeChars = Array.from(unicode); // Handle surrogate pairs correctly
  let lastExplicitConsonantToken: string | null = null;
  const reverseTrie = getReverseMappingTrie();

  while (i < unicodeChars.length) {
    let match: ReverseMappingEntry | null = null;
    
    // Try to match longest Unicode sequence first
    for (const entry of reverseTrie) {
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
          for (const entry of reverseTrie) {
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
            const nextSignificantUnicodeChar = getNextSignificantUnicodeChar(
              unicodeChars,
              nextIdx + Array.from(nextMatch.unicode).length
            );
            const needsClusterSeparator =
              i > 0 &&
              unicodeChars[i - 1] === '\u094D' &&
              lastExplicitConsonantToken !== null &&
              VEDIC_MAPPINGS.some((entry) => entry.itrans === `${lastExplicitConsonantToken}${match.itrans}`);
            const needsHiatusSeparator = INDEPENDENT_VOWEL_UNICODE_SET.has(nextSignificantUnicodeChar);

            if (needsClusterSeparator) {
              itrans += '/';
            }

            itrans += match.itrans + nextMatch.itrans;
            if (needsHiatusSeparator) {
              itrans += '/';
            }
            lastExplicitConsonantToken = null;
            i += matchLen + Array.from(nextMatch.unicode).length;
          }
        } else {
          // Consonant alone -> output base itrans + implicit 'a'
          const nextUnicodeChar = getNextSignificantUnicodeChar(unicodeChars, nextIdx);
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
        const previousUnicodeChar = getPreviousSignificantUnicodeChar(unicodeChars, i - 1);
        const needsVowelSeparator =
          match.category === 'vowel' &&
          !itrans.endsWith('/') &&
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

  return formatSourceForOutput(itrans, { outputScheme: options?.outputScheme });
};
