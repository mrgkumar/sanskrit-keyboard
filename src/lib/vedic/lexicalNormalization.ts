export const LEXICAL_LOOKUP_SWARA_PATTERN = /\\?(?:''|['"_^])/g;
export const CANONICAL_CORPUS_NON_LEXICAL_PATTERN = /_(?:MM~|M~)_/g;
export const CANONICAL_VALIDATION_SWARA_PATTERN = /\\?(?:''|['"_])/g;
const VOCALIC_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/R\^I/g, 'RRI'],
  [/R\^i/g, 'RRi'],
  [/L\^I/g, 'LLI'],
  [/L\^i/g, 'LLi'],
];

export const canonicalizeLexicalItrans = (value: string) => {
  let next = value;
  for (const [pattern, replacement] of VOCALIC_ALIAS_PATTERNS) {
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
