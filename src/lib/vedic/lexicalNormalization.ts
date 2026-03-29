export const LEXICAL_LOOKUP_SWARA_PATTERN = /\\?(?:''|['"_^])/g;
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
