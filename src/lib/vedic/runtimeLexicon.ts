export interface LexicalSuggestion {
  itrans: string;
  devanagari: string;
  count: number;
}

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

const MANIFEST_URL = '/api/autocomplete/runtime-lexicon-shards-manifest.json';
const SHARD_API_ROOT = '/api/autocomplete';
const SHARD_PREFIX_LENGTH = 2;
const MIN_LOOKUP_PREFIX_LENGTH = 2;
const MAX_INDEXED_PREFIX_LENGTH = 12;
const MAX_INDEXED_SUGGESTIONS = 8;

let manifestPromise: Promise<RuntimeLexiconShardManifest> | null = null;
const shardCache = new Map<string, Promise<LoadedLexiconShard>>();

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

export const shouldLookupLexicalSuggestions = (prefix: string) =>
  prefix.length >= MIN_LOOKUP_PREFIX_LENGTH &&
  /[A-Za-z]/.test(prefix) &&
  !prefix.includes('\\');

export const getLexicalSuggestions = async (prefix: string, limit = 5) => {
  if (!shouldLookupLexicalSuggestions(prefix)) {
    return [] as LexicalSuggestion[];
  }

  const shard = await loadShard(toShardPrefix(prefix));
  return (shard.suggestionsByPrefix.get(prefix) ?? []).slice(0, limit);
};
