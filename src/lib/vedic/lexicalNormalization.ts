export const LEXICAL_LOOKUP_SWARA_PATTERN = /\\?(?:''|['"_^])/g;
export const CANONICAL_CORPUS_NON_LEXICAL_PATTERN = /_(?:MM~|M~)_/g;
export const CANONICAL_VALIDATION_SWARA_PATTERN = /\\?(?:''|['"_])/g;
const VOCALIC_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/RU/g, 'RRI'],
  [/Ru/g, 'RRi'],
  [/R\^I/g, 'RRI'],
  [/R\^i/g, 'RRi'],
  [/~lU/g, 'LLI'],
  [/~lu/g, 'LLi'],
  [/L\^I/g, 'LLI'],
  [/L\^i/g, 'LLi'],
];
const BARAHA_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/\boum\b/g, 'OM'],
  [/\bou\b/g, 'au'],
  [/\bee\b/g, 'I'],
  [/\boo\b/g, 'U'],
  [/\bK/g, 'kh'],
  [/\bG/g, 'gh'],
  [/\bC/g, 'Ch'],
  [/\bJ/g, 'jh'],
  [/\bP/g, 'ph'],
  [/\bB/g, 'bh'],
  [/~g/g, '~N'],
  [/~j/g, '~n'],
  [/&/g, '.a'],
];

export const canonicalizeLexicalItrans = (value: string) => {
  let next = value;
  for (const [pattern, replacement] of VOCALIC_ALIAS_PATTERNS) {
    next = next.replace(pattern, replacement);
  }
  for (const [pattern, replacement] of BARAHA_ALIAS_PATTERNS) {
    next = next.replace(pattern, replacement);
  }

  return next;
};

export const normalizeForLexicalLookup = (value: string) =>
  canonicalizeLexicalItrans(value).replace(LEXICAL_LOOKUP_SWARA_PATTERN, '').trim();

export const hasLexicalSvaraMarkers = (value: string) =>
  normalizeForLexicalLookup(value) !== value;

export const normalizeForCanonicalValidation = (value: string) =>
  value
    .replace(CANONICAL_CORPUS_NON_LEXICAL_PATTERN, '')
    .replace(CANONICAL_VALIDATION_SWARA_PATTERN, '')
    .trim();

export const normalizeForCanonicalLexiconTraining = (value: string) =>
  normalizeForLexicalLookup(normalizeForCanonicalValidation(value));
