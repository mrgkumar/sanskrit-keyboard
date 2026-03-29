const DEVANAGARI_TOKEN_REGEX =
  /[\p{Script_Extensions=Devanagari}\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]+/gu;
const DEVANAGARI_LEXICAL_MARKS_PATTERN = /[\u0951\u0952\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]/gu;
const PRIVATE_USE_CHAR_REGEX = /[\uE000-\uF8FF]/gu;
const EDGE_PUNCTUATION_REGEX = /^[।॥]+|[।॥]+$/gu;
const LEADING_INVALID_CORPUS_MARK_REGEX = /^[\u093A-\u094C\u0951\u0952\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]/u;
const LEADING_INDEPENDENT_VOWEL_WITH_MATRA_REGEX = /^[\u0904-\u0914][\u093A-\u094C\u0962\u0963]/u;
const SUPPORTED_PRIVATE_USE_CHARS = new Set(['\uE001', '\uE002', '\uF156', '\uF176']);

const hasUnsupportedPrivateUseChars = (value: string) =>
  [...value.matchAll(PRIVATE_USE_CHAR_REGEX)].some(
    (match) => !SUPPORTED_PRIVATE_USE_CHARS.has(match[0])
  );

export const sanitizeDevanagariCorpusToken = (token: string) => {
  const trimmed = token.trim().replace(EDGE_PUNCTUATION_REGEX, '');
  if (!trimmed) {
    return null;
  }

  if (LEADING_INVALID_CORPUS_MARK_REGEX.test(trimmed)) {
    return null;
  }

  if (LEADING_INDEPENDENT_VOWEL_WITH_MATRA_REGEX.test(trimmed)) {
    return null;
  }

  if (hasUnsupportedPrivateUseChars(trimmed)) {
    return null;
  }

  return trimmed;
};

export const tokenizeDevanagariText = (text: string) =>
  [...text.matchAll(DEVANAGARI_TOKEN_REGEX)]
    .map((match) => sanitizeDevanagariCorpusToken(match[0]))
    .filter((token): token is string => token !== null);

export const stripDevanagariLexicalMarks = (value: string) =>
  value.replace(DEVANAGARI_LEXICAL_MARKS_PATTERN, '').trim();
