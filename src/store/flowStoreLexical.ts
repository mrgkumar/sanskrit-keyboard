// app/src/store/flowStoreLexical.ts
import { CanonicalBlock } from './types';
import {
  applyLearnedSwaraVariants,
  accumulateExactFormUsageFromText,
  incrementExactFormUsage,
  getLexicalSuggestions,
  mergeLexicalSuggestionsWithSessionCounts,
  normalizeForLexicalLookup,
  preloadRuntimeLexiconAssets,
  shouldLookupLexicalSuggestions,
  type ExactFormUsageCounts,
  type LexicalUsageCounts,
  type LexicalSuggestion,
} from '@/lib/vedic/runtimeLexicon';

export const DEFAULT_SWARA_PREDICTION_ENABLED = true;

const SESSION_LEXICAL_TOKEN_PATTERN = /[A-Za-z0-9\\^'"_~.=\/&#$]+/g;

const extractLexicalTokens = (source: string) =>
  source.match(SESSION_LEXICAL_TOKEN_PATTERN) ?? [];

export const incrementSessionLexicalUsage = (counts: LexicalUsageCounts, rawValue: string) => {
  const normalized = normalizeForLexicalLookup(rawValue);
  if (!shouldLookupLexicalSuggestions(normalized)) {
    return counts;
  }

  return {
    ...counts,
    [normalized]: (counts[normalized] ?? 0) + 1,
  };
};

export const accumulateSessionLexicalUsageFromText = (
  counts: LexicalUsageCounts,
  source: string
) => {
  let nextCounts = counts;
  const matches = extractLexicalTokens(source);

  for (const token of matches) {
    nextCounts = incrementSessionLexicalUsage(nextCounts, token);
  }

  return nextCounts;
};

export const accumulateSessionExactFormUsageFromText = (
  counts: ExactFormUsageCounts,
  source: string
) => accumulateExactFormUsageFromText(counts, extractLexicalTokens(source));

export const deriveSessionLexicalUsageFromBlocks = (blocks: CanonicalBlock[]) => {
  let counts: LexicalUsageCounts = {};

  for (const block of blocks) {
    counts = accumulateSessionLexicalUsageFromText(counts, block.source);
  }

  return counts;
};

export const deriveSessionExactFormUsageFromBlocks = (blocks: CanonicalBlock[]) => {
  let counts: ExactFormUsageCounts = {};

  for (const block of blocks) {
    counts = accumulateSessionExactFormUsageFromText(counts, block.source);
  }

  return counts;
};

export {
  applyLearnedSwaraVariants,
  getLexicalSuggestions,
  incrementExactFormUsage,
  mergeLexicalSuggestionsWithSessionCounts,
  normalizeForLexicalLookup,
  preloadRuntimeLexiconAssets,
  shouldLookupLexicalSuggestions,
};

export type {
  ExactFormUsageCounts,
  LexicalUsageCounts,
  LexicalSuggestion,
};
