import { transliterate } from '@/lib/vedic/utils';
import {
  hasLexicalSvaraMarkers,
  normalizeForLexicalLookup,
} from '@/lib/vedic/lexicalNormalization';
export { hasLexicalSvaraMarkers, normalizeForLexicalLookup } from '@/lib/vedic/lexicalNormalization';

export interface LexicalSuggestion {
  itrans: string;
  devanagari: string;
  count: number;
  normalizedItrans?: string;
}

export type LexicalUsageCounts = Record<string, number>;
export type ExactFormUsageCounts = Record<string, Record<string, number>>;

interface RuntimeLexiconShardManifestEntry {
  prefix: string;
  file: string;
  entryCount: number;
  bytes: number;
}

interface RuntimeLexiconShardManifest {
  version: number;
  shards: RuntimeLexiconShardManifestEntry[];
}

interface RuntimeLexiconShardFile {
  version: number;
  prefix: string;
  entries: LexicalSuggestion[];
}

interface LoadedLexiconShard {
  prefix: string;
  suggestionsByPrefix: Map<string, LexicalSuggestion[]>;
}

interface SwaraLexiconVariant {
  itrans: string;
  devanagari: string;
  count: number;
}

interface SwaraLexiconEntry {
  normalized: string;
  variants: SwaraLexiconVariant[];
}

interface SwaraLexiconFile {
  version: number;
  entryCount: number;
  entries: SwaraLexiconEntry[];
}

const MANIFEST_URL = '/api/autocomplete/runtime-lexicon-shards-manifest.json';
const SHARD_API_ROOT = '/api/autocomplete';
const SWARA_LEXICON_URL = '/api/autocomplete/swara-lexicon.json';
const SHARD_PREFIX_LENGTH = 2;
const MIN_LOOKUP_PREFIX_LENGTH = 2;
const MAX_INDEXED_PREFIX_LENGTH = 12;
const MAX_INDEXED_SUGGESTIONS = 8;
const SESSION_USAGE_WEIGHT = 100;
const USER_USAGE_WEIGHT = 40;
const SWARA_CORPUS_WEIGHT = 1;
const SWARA_USER_WEIGHT = 8;
const SWARA_SESSION_WEIGHT = 12;

let manifestPromise: Promise<RuntimeLexiconShardManifest> | null = null;
let swaraLexiconPromise: Promise<Map<string, SwaraLexiconVariant[]>> | null = null;
const shardCache = new Map<string, Promise<LoadedLexiconShard>>();

export const resetRuntimeLexiconCacheForTests = () => {
  manifestPromise = null;
  swaraLexiconPromise = null;
  shardCache.clear();
};

const compareSuggestions = (left: LexicalSuggestion, right: LexicalSuggestion) => {
  if (right.count !== left.count) {
    return right.count - left.count;
  }

  if (left.itrans.length !== right.itrans.length) {
    return left.itrans.length - right.itrans.length;
  }

  return left.itrans.localeCompare(right.itrans);
};

const toShardPrefix = (value: string) =>
  Array.from(value).slice(0, SHARD_PREFIX_LENGTH).join('') || '_';

const insertSuggestion = (bucket: LexicalSuggestion[], entry: LexicalSuggestion) => {
  if (bucket.some((existing) => existing.itrans === entry.itrans)) {
    return;
  }

  bucket.push(entry);
  bucket.sort(compareSuggestions);
  if (bucket.length > MAX_INDEXED_SUGGESTIONS) {
    bucket.length = MAX_INDEXED_SUGGESTIONS;
  }
};

const buildPrefixIndex = (entries: LexicalSuggestion[]) => {
  const suggestionsByPrefix = new Map<string, LexicalSuggestion[]>();

  for (const entry of entries) {
    const maxLength = Math.min(MAX_INDEXED_PREFIX_LENGTH, entry.itrans.length);
    for (let length = MIN_LOOKUP_PREFIX_LENGTH; length <= maxLength; length++) {
      const prefix = entry.itrans.slice(0, length);
      const bucket = suggestionsByPrefix.get(prefix) ?? [];
      insertSuggestion(bucket, entry);
      suggestionsByPrefix.set(prefix, bucket);
    }
  }

  return suggestionsByPrefix;
};

const loadManifest = async () => {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load runtime lexicon manifest: ${response.status}`);
      }

      return response.json() as Promise<RuntimeLexiconShardManifest>;
    });
  }

  return manifestPromise;
};

const loadShard = async (prefix: string) => {
  if (!shardCache.has(prefix)) {
    shardCache.set(
      prefix,
      (async () => {
        const manifest = await loadManifest();
        const shardMeta = manifest.shards.find((entry) => entry.prefix === prefix);
        if (!shardMeta) {
          return {
            prefix,
            suggestionsByPrefix: new Map<string, LexicalSuggestion[]>(),
          };
        }

        const response = await fetch(`${SHARD_API_ROOT}/${shardMeta.file}`);
        if (!response.ok) {
          throw new Error(`Failed to load runtime lexicon shard ${prefix}: ${response.status}`);
        }

        const shard = await response.json() as RuntimeLexiconShardFile;
        return {
          prefix,
          suggestionsByPrefix: buildPrefixIndex(shard.entries),
        };
      })()
    );
  }

  return shardCache.get(prefix)!;
};

export const shouldLookupLexicalSuggestions = (prefix: string) => {
  const normalizedPrefix = normalizeForLexicalLookup(prefix);
  return normalizedPrefix.length >= MIN_LOOKUP_PREFIX_LENGTH && /[A-Za-z]/.test(normalizedPrefix);
};

export const incrementExactFormUsage = (
  counts: ExactFormUsageCounts,
  rawValue: string
) => {
  const normalized = normalizeForLexicalLookup(rawValue);
  if (!shouldLookupLexicalSuggestions(normalized) || !hasLexicalSvaraMarkers(rawValue)) {
    return counts;
  }

  return {
    ...counts,
    [normalized]: {
      ...(counts[normalized] ?? {}),
      [rawValue]: ((counts[normalized] ?? {})[rawValue] ?? 0) + 1,
    },
  };
};

export const accumulateExactFormUsageFromText = (
  counts: ExactFormUsageCounts,
  tokens: string[]
) => {
  let nextCounts = counts;

  for (const token of tokens) {
    nextCounts = incrementExactFormUsage(nextCounts, token);
  }

  return nextCounts;
};

export const getLexicalSuggestions = async (prefix: string, limit = 5) => {
  const normalizedPrefix = normalizeForLexicalLookup(prefix);

  if (!shouldLookupLexicalSuggestions(normalizedPrefix)) {
    return [] as LexicalSuggestion[];
  }

  const shard = await loadShard(toShardPrefix(normalizedPrefix));
  return (shard.suggestionsByPrefix.get(normalizedPrefix) ?? []).slice(0, limit);
};

const loadSwaraLexicon = async () => {
  if (!swaraLexiconPromise) {
    swaraLexiconPromise = fetch(SWARA_LEXICON_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Failed to load swara lexicon: ${response.status}`);
      }

      const payload = await response.json() as SwaraLexiconFile;
      return new Map(payload.entries.map((entry) => [entry.normalized, entry.variants]));
    });
  }

  return swaraLexiconPromise;
};

export const preloadRuntimeLexiconAssets = (includeSwara = false) => {
  void loadManifest().catch(() => undefined);
  if (includeSwara) {
    void loadSwaraLexicon().catch(() => undefined);
  }
};

export const mergeLexicalSuggestionsWithSessionCounts = ({
  prefix,
  baseSuggestions,
  sessionUsageCounts,
  userUsageCounts = {},
  limit = 5,
}: {
  prefix: string;
  baseSuggestions: LexicalSuggestion[];
  sessionUsageCounts: LexicalUsageCounts;
  userUsageCounts?: LexicalUsageCounts;
  limit?: number;
}) => {
  const normalizedPrefix = normalizeForLexicalLookup(prefix);
  const merged = new Map<
    string,
    LexicalSuggestion & {
      baseCount: number;
      sessionCount: number;
      userCount: number;
      score: number;
    }
  >();

  for (const entry of baseSuggestions) {
    merged.set(entry.itrans, {
      ...entry,
      normalizedItrans: entry.normalizedItrans ?? entry.itrans,
      baseCount: entry.count,
      sessionCount: sessionUsageCounts[entry.itrans] ?? 0,
      userCount: userUsageCounts[entry.itrans] ?? 0,
      score:
        entry.count +
        (sessionUsageCounts[entry.itrans] ?? 0) * SESSION_USAGE_WEIGHT +
        (userUsageCounts[entry.itrans] ?? 0) * USER_USAGE_WEIGHT,
    });
  }

  for (const [itrans, sessionCount] of Object.entries(sessionUsageCounts)) {
    if (sessionCount <= 0 || !itrans.startsWith(normalizedPrefix)) {
      continue;
    }

    const existing = merged.get(itrans);
    if (existing) {
      existing.sessionCount = sessionCount;
      existing.score =
        existing.baseCount +
        sessionCount * SESSION_USAGE_WEIGHT +
        existing.userCount * USER_USAGE_WEIGHT;
      continue;
    }

    merged.set(itrans, {
      itrans,
      devanagari: transliterate(itrans).unicode,
      count: sessionCount,
      normalizedItrans: itrans,
      baseCount: 0,
      sessionCount,
      userCount: userUsageCounts[itrans] ?? 0,
      score: sessionCount * SESSION_USAGE_WEIGHT + (userUsageCounts[itrans] ?? 0) * USER_USAGE_WEIGHT,
    });
  }

  for (const [itrans, userCount] of Object.entries(userUsageCounts)) {
    if (userCount <= 0 || !itrans.startsWith(normalizedPrefix) || merged.has(itrans)) {
      continue;
    }

    merged.set(itrans, {
      itrans,
      devanagari: transliterate(itrans).unicode,
      count: userCount,
      normalizedItrans: itrans,
      baseCount: 0,
      sessionCount: 0,
      userCount,
      score: userCount * USER_USAGE_WEIGHT,
    });
  }

  return [...merged.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.sessionCount !== left.sessionCount) {
        return right.sessionCount - left.sessionCount;
      }

      if (right.userCount !== left.userCount) {
        return right.userCount - left.userCount;
      }

      if (right.baseCount !== left.baseCount) {
        return right.baseCount - left.baseCount;
      }

      if (left.itrans.length !== right.itrans.length) {
        return left.itrans.length - right.itrans.length;
      }

      return left.itrans.localeCompare(right.itrans);
    })
    .slice(0, limit)
    .map((entry) => ({
      itrans: entry.itrans,
      devanagari: entry.devanagari,
      count: entry.count,
      normalizedItrans: entry.normalizedItrans,
    }));
};

const rankExactFormVariants = ({
  normalized,
  typedPrefix,
  sessionExactForms,
  userExactForms,
  corpusVariants,
}: {
  normalized: string;
  typedPrefix: string;
  sessionExactForms: ExactFormUsageCounts;
  userExactForms: ExactFormUsageCounts;
  corpusVariants: SwaraLexiconVariant[];
}) => {
  const typedPrefixLower = typedPrefix.toLowerCase();
  const variants = new Map<
    string,
    {
      itrans: string;
      devanagari: string;
      corpusCount: number;
      userCount: number;
      sessionCount: number;
      prefixBonus: number;
      score: number;
    }
  >();

  for (const variant of corpusVariants) {
    variants.set(variant.itrans, {
      itrans: variant.itrans,
      devanagari: variant.devanagari,
      corpusCount: variant.count,
      userCount: 0,
      sessionCount: 0,
      prefixBonus: 0,
      score: variant.count * SWARA_CORPUS_WEIGHT,
    });
  }

  for (const [itrans, count] of Object.entries(userExactForms[normalized] ?? {})) {
    const existing = variants.get(itrans);
    const next = existing ?? {
      itrans,
      devanagari: transliterate(itrans).unicode,
      corpusCount: 0,
      userCount: 0,
      sessionCount: 0,
      prefixBonus: 0,
      score: 0,
    };
    next.userCount = count;
    next.score = next.corpusCount * SWARA_CORPUS_WEIGHT + count * SWARA_USER_WEIGHT + next.sessionCount * SWARA_SESSION_WEIGHT;
    variants.set(itrans, next);
  }

  for (const [itrans, count] of Object.entries(sessionExactForms[normalized] ?? {})) {
    const existing = variants.get(itrans);
    const next = existing ?? {
      itrans,
      devanagari: transliterate(itrans).unicode,
      corpusCount: 0,
      userCount: 0,
      sessionCount: 0,
      prefixBonus: 0,
      score: 0,
    };
    next.sessionCount = count;
    next.score = next.corpusCount * SWARA_CORPUS_WEIGHT + next.userCount * SWARA_USER_WEIGHT + count * SWARA_SESSION_WEIGHT;
    variants.set(itrans, next);
  }

  for (const variant of variants.values()) {
    variant.prefixBonus = typedPrefixLower.length > 0 && variant.itrans.toLowerCase().startsWith(typedPrefixLower) ? 1000 : 0;
    variant.score += variant.prefixBonus;
  }

  return [...variants.values()]
    .filter((variant) => hasLexicalSvaraMarkers(variant.itrans))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.sessionCount !== left.sessionCount) {
        return right.sessionCount - left.sessionCount;
      }

      if (right.userCount !== left.userCount) {
        return right.userCount - left.userCount;
      }

      if (right.corpusCount !== left.corpusCount) {
        return right.corpusCount - left.corpusCount;
      }

      if (left.itrans.length !== right.itrans.length) {
        return left.itrans.length - right.itrans.length;
      }

      return left.itrans.localeCompare(right.itrans);
    });
};

export const applyLearnedSwaraVariants = async ({
  suggestions,
  typedPrefix,
  enabled,
  sessionExactForms,
  userExactForms,
}: {
  suggestions: LexicalSuggestion[];
  typedPrefix: string;
  enabled: boolean;
  sessionExactForms: ExactFormUsageCounts;
  userExactForms: ExactFormUsageCounts;
}) => {
  if (!enabled || suggestions.length === 0) {
    return suggestions;
  }

  let corpusVariantMap = new Map<string, SwaraLexiconVariant[]>();
  try {
    corpusVariantMap = await loadSwaraLexicon();
  } catch {
    corpusVariantMap = new Map<string, SwaraLexiconVariant[]>();
  }

  return suggestions.map((suggestion) => {
    const normalized = suggestion.normalizedItrans ?? normalizeForLexicalLookup(suggestion.itrans);
    const rankedVariants = rankExactFormVariants({
      normalized,
      typedPrefix,
      sessionExactForms,
      userExactForms,
      corpusVariants: corpusVariantMap.get(normalized) ?? [],
    });
    const preferred = rankedVariants[0];

    if (!preferred) {
      return {
        ...suggestion,
        normalizedItrans: normalized,
      };
    }

    return {
      ...suggestion,
      itrans: preferred.itrans,
      devanagari: preferred.devanagari,
      normalizedItrans: normalized,
    };
  });
};
