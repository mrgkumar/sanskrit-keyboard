import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import {
  CORPUS_DATASETS,
  type CanonicalRecordConfig,
  type NdjsonRecordDataset,
  resolveCorpusDataset,
} from './corpusRegistry.ts';
import {
  resolvePredictionExperimentProfile,
  type PredictionExperimentProfile,
} from './predictionExperimentProfiles.ts';
import { processCanonicalRow } from '../scripts/buildCanonicalLexiconShared.ts';
import { normalizeForLexicalLookup } from '../src/lib/vedic/lexicalNormalization.ts';

export interface RuntimeLexiconEntry {
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
  entries: RuntimeLexiconEntry[];
}

interface LoadedShardData {
  entries: RuntimeLexiconEntry[];
  entrySet: Set<string>;
  prefixCache: Map<string, RuntimeLexiconEntry[]>;
}

interface PreparedDatasetSampleOptions {
  maxQueries: number;
}

interface SourceCountIndexEntry {
  totalCount: number;
  bySource: Record<string, number>;
}

interface FileFingerprint {
  path: string;
  size: number;
  mtimeMs: number;
}

interface PrefixMetrics {
  queries: number;
  top1Hits: number;
  top3Hits: number;
  top5Hits: number;
}

interface MissSample {
  datasetId: string;
  rowId: string;
  prefix: string;
  target: string;
  devanagari: string;
  suggestions: string[];
}

type EvaluatableDataset = NdjsonRecordDataset & {
  canonical: CanonicalRecordConfig;
};

export interface DatasetEvaluationResult {
  profileId: string;
  datasetId: string;
  datasetLabel: string;
  rowCount: number;
  skippedRows: number;
  eligibleWords: number;
  inLexiconWords: number;
  missingWords: number;
  prefixMetrics: {
    finalPrefix: PrefixMetrics;
    allPrefixes: PrefixMetrics;
  };
  sampleMisses: MissSample[];
}

export interface PreparedEvaluationQuery {
  rowId: string;
  target: string;
  devanagari: string;
  weight: number;
}

export interface PreparedDatasetEvaluation {
  datasetId: string;
  datasetLabel: string;
  rowCount: number;
  skippedRows: number;
  eligibleWords: number;
  queries: PreparedEvaluationQuery[];
}

interface CachedPreparedDatasetEvaluation {
  version: number;
  source: FileFingerprint;
  prepared: PreparedDatasetEvaluation;
}

interface CachedSourceIndexPayload {
  version: number;
  source: FileFingerprint;
  sourceIndex: Array<[string, SourceCountIndexEntry]>;
}

const SHARD_PREFIX_LENGTH = 2;
const MIN_LOOKUP_PREFIX_LENGTH = 2;
const MAX_SAMPLED_MISSES = 10;
const DEFAULT_SUGGESTION_LIMIT = 5;
const CANONICAL_MAPPING_FILE = 'canonical-mapping.ndjson';
const PREPARED_DATASET_CACHE_VERSION = 2;
const SOURCE_INDEX_CACHE_VERSION = 1;
const ALLOWED_ITRANS_SIGNS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~:/.^_|'\\");

const toFileFingerprint = (filePath: string): FileFingerprint => {
  const stats = fs.statSync(filePath);
  return {
    path: path.resolve(filePath),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  };
};

const fingerprintsMatch = (left: FileFingerprint, right: FileFingerprint) =>
  left.path === right.path && left.size === right.size && left.mtimeMs === right.mtimeMs;

export const shouldApplyCompletionDistancePenalty = (
  entry: RuntimeLexiconEntry,
  prefix: string,
  profile: PredictionExperimentProfile
) => {
  const remainingLength = Math.max(entry.itrans.length - prefix.length, 0);
  const withinRemainingLength =
    profile.activationMaxRemainingLength === null || remainingLength <= profile.activationMaxRemainingLength;

  return (
    prefix.length >= profile.activationMinPrefixLength &&
    prefix.length / Math.max(entry.itrans.length, 1) >= profile.activationMinPrefixRatio &&
    withinRemainingLength
  );
};

const getWeightedCount = (
  entry: RuntimeLexiconEntry,
  profile: PredictionExperimentProfile,
  sourceInfo?: SourceCountIndexEntry
) => {
  if (!profile.sourceWeights || !sourceInfo) {
    return entry.count;
  }

  let weightedCount = 0;
  for (const [source, count] of Object.entries(sourceInfo.bySource)) {
    weightedCount += count * (profile.sourceWeights[source] ?? 1);
  }

  return weightedCount;
};

export const computeLexicalNoisePenalty = (itrans: string) => {
  let penalty = 0;

  if (anyChar(itrans, (char) => char.codePointAt(0)! > 127)) {
    penalty += 200;
  }

  if (anyChar(itrans, (char) => /[0-9]/.test(char))) {
    penalty += 120;
  }

  if (anyChar(itrans, (char) => !/[A-Za-z0-9]/.test(char) && !ALLOWED_ITRANS_SIGNS.has(char))) {
    penalty += 200;
  }

  if (itrans.includes('//') || itrans.includes('__')) {
    penalty += 80;
  }

  if ((itrans.match(/:/g) ?? []).length > 1) {
    penalty += 40;
  }

  if (itrans.length >= 24) {
    penalty += 25;
  }

  return penalty;
};

const anyChar = (value: string, predicate: (char: string) => boolean) => {
  for (const char of value) {
    if (predicate(char)) {
      return true;
    }
  }

  return false;
};

const getContinuationBranchKey = (
  entry: RuntimeLexiconEntry,
  prefix: string,
  profile: PredictionExperimentProfile
) => {
  if (profile.continuationBranchPenalty <= 0) {
    return '';
  }

  const remaining = entry.itrans.slice(prefix.length);
  if (!remaining) {
    return '';
  }

  return remaining.slice(0, profile.continuationBranchDepth);
};

const getContinuationBranchPenalty = (
  entry: RuntimeLexiconEntry,
  prefix: string,
  profile: PredictionExperimentProfile,
  continuationBranchCounts?: Map<string, number>
) => {
  if (profile.continuationBranchPenalty <= 0 || !continuationBranchCounts) {
    return 0;
  }

  const branchKey = getContinuationBranchKey(entry, prefix, profile);
  if (!branchKey) {
    return 0;
  }

  return (continuationBranchCounts.get(branchKey) ?? 1) * profile.continuationBranchPenalty;
};

const compareSuggestions = (
  left: RuntimeLexiconEntry,
  right: RuntimeLexiconEntry,
  prefix: string,
  profile: PredictionExperimentProfile,
  sourceIndex?: Map<string, SourceCountIndexEntry>,
  continuationBranchCounts?: Map<string, number>
) => {
  const leftWeightedCount = getWeightedCount(left, profile, sourceIndex?.get(left.itrans));
  const rightWeightedCount = getWeightedCount(right, profile, sourceIndex?.get(right.itrans));
  const leftNoisePenalty = computeLexicalNoisePenalty(left.itrans) * profile.noisePenaltyMultiplier;
  const rightNoisePenalty = computeLexicalNoisePenalty(right.itrans) * profile.noisePenaltyMultiplier;
  const leftPenaltyWeight = shouldApplyCompletionDistancePenalty(left, prefix, profile)
    ? profile.remainingLengthPenalty
    : 0;
  const rightPenaltyWeight = shouldApplyCompletionDistancePenalty(right, prefix, profile)
    ? profile.remainingLengthPenalty
    : 0;
  const leftContinuationPenalty = getContinuationBranchPenalty(left, prefix, profile, continuationBranchCounts);
  const rightContinuationPenalty = getContinuationBranchPenalty(right, prefix, profile, continuationBranchCounts);
  const leftScore =
    leftWeightedCount -
    leftNoisePenalty -
    leftContinuationPenalty -
    (left.itrans.length - prefix.length) * leftPenaltyWeight;
  const rightScore =
    rightWeightedCount -
    rightNoisePenalty -
    rightContinuationPenalty -
    (right.itrans.length - prefix.length) * rightPenaltyWeight;

  if (rightScore !== leftScore) {
    return rightScore - leftScore;
  }

  if (rightWeightedCount !== leftWeightedCount) {
    return rightWeightedCount - leftWeightedCount;
  }

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

const insertSuggestion = (
  bucket: RuntimeLexiconEntry[],
  entry: RuntimeLexiconEntry,
  prefix: string,
  profile: PredictionExperimentProfile,
  sourceIndex?: Map<string, SourceCountIndexEntry>,
  continuationBranchCounts?: Map<string, number>
) => {
  if (bucket.some((existing) => existing.itrans === entry.itrans)) {
    return;
  }

  bucket.push(entry);
  bucket.sort((left, right) => compareSuggestions(left, right, prefix, profile, sourceIndex, continuationBranchCounts));
  if (bucket.length > profile.candidatePoolLimit) {
    bucket.length = profile.candidatePoolLimit;
  }
};

const incrementMetric = (metric: PrefixMetrics, suggestions: RuntimeLexiconEntry[], target: string, weight: number) => {
  metric.queries += weight;
  if (suggestions[0]?.itrans === target) {
    metric.top1Hits += weight;
  }

  if (suggestions.slice(0, 3).some((entry) => entry.itrans === target)) {
    metric.top3Hits += weight;
  }

  if (suggestions.slice(0, 5).some((entry) => entry.itrans === target)) {
    metric.top5Hits += weight;
  }
};

const toRate = (hits: number, queries: number) => (queries > 0 ? hits / queries : 0);

export const summarizePrefixMetrics = (metric: PrefixMetrics) => ({
  queries: metric.queries,
  top1Hits: metric.top1Hits,
  top3Hits: metric.top3Hits,
  top5Hits: metric.top5Hits,
  top1Rate: toRate(metric.top1Hits, metric.queries),
  top3Rate: toRate(metric.top3Hits, metric.queries),
  top5Rate: toRate(metric.top5Hits, metric.queries),
});

export const samplePreparedDatasetEvaluation = (
  prepared: PreparedDatasetEvaluation,
  options: PreparedDatasetSampleOptions
): PreparedDatasetEvaluation => {
  if (options.maxQueries >= prepared.queries.length) {
    return prepared;
  }

  const sampledQueries = [...prepared.queries]
    .sort((left, right) => {
      if (right.weight !== left.weight) {
        return right.weight - left.weight;
      }

      return left.target.localeCompare(right.target);
    })
    .slice(0, options.maxQueries);

  return {
    ...prepared,
    eligibleWords: sampledQueries.reduce((sum, query) => sum + query.weight, 0),
    queries: sampledQueries,
  };
};

export const buildRuntimeLexiconSourceIndex = async (dataRoot: string) => {
  const canonicalPath = path.join(dataRoot, CANONICAL_MAPPING_FILE);
  const sourceIndex = new Map<string, SourceCountIndexEntry>();

  const rl = readline.createInterface({
    input: fs.createReadStream(canonicalPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const record = JSON.parse(line) as { itrans: string; source?: string | null };
    const itrans = normalizeForLexicalLookup(record.itrans);
    if (itrans.length < MIN_LOOKUP_PREFIX_LENGTH) {
      continue;
    }

    const source = record.source ?? 'unknown';
    const current = sourceIndex.get(itrans) ?? {
      totalCount: 0,
      bySource: {},
    };
    current.totalCount += 1;
    current.bySource[source] = (current.bySource[source] ?? 0) + 1;
    sourceIndex.set(itrans, current);
  }

  return sourceIndex;
};

export const buildRuntimeLexiconSourceIndexCached = async ({
  dataRoot,
  cacheDir,
}: {
  dataRoot: string;
  cacheDir: string;
}) => {
  const canonicalPath = path.join(dataRoot, CANONICAL_MAPPING_FILE);
  const sourceFingerprint = toFileFingerprint(canonicalPath);
  const cachePath = path.join(cacheDir, 'runtime-lexicon-source-index.json');

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CachedSourceIndexPayload;
      if (
        cached.version === SOURCE_INDEX_CACHE_VERSION &&
        fingerprintsMatch(cached.source, sourceFingerprint)
      ) {
        return new Map<string, SourceCountIndexEntry>(cached.sourceIndex);
      }
    } catch {
      // Ignore stale or malformed cache and rebuild below.
    }
  }

  const sourceIndex = await buildRuntimeLexiconSourceIndex(dataRoot);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    cachePath,
    `${JSON.stringify(
      {
        version: SOURCE_INDEX_CACHE_VERSION,
        source: sourceFingerprint,
        sourceIndex: Array.from(sourceIndex.entries()),
      } satisfies CachedSourceIndexPayload,
      null,
      2
    )}\n`,
    'utf8'
  );

  return sourceIndex;
};

export class DiskRuntimeLexicon {
  private readonly manifest: RuntimeLexiconShardManifest;
  private readonly dataRoot: string;
  private readonly shardCache = new Map<string, LoadedShardData>();
  private readonly sourceIndex?: Map<string, SourceCountIndexEntry>;

  constructor(dataRoot: string, sourceIndex?: Map<string, SourceCountIndexEntry>) {
    this.dataRoot = dataRoot;
    this.sourceIndex = sourceIndex;
    const manifestPath = path.join(dataRoot, 'runtime-lexicon-shards-manifest.json');
    this.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RuntimeLexiconShardManifest;
  }

  private loadShardData(prefix: string) {
    if (!this.shardCache.has(prefix)) {
      const shardMeta = this.manifest.shards.find((entry) => entry.prefix === prefix);
      if (!shardMeta) {
        this.shardCache.set(prefix, {
          entries: [],
          entrySet: new Set<string>(),
          prefixCache: new Map<string, RuntimeLexiconEntry[]>(),
        });
      } else {
        const shardPath = path.join(this.dataRoot, shardMeta.file);
        const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8')) as RuntimeLexiconShardFile;
        this.shardCache.set(prefix, {
          entries: shard.entries,
          entrySet: new Set(shard.entries.map((entry) => entry.itrans)),
          prefixCache: new Map<string, RuntimeLexiconEntry[]>(),
        });
      }
    }

    return this.shardCache.get(prefix)!;
  }

  private getSuggestionsForNormalizedPrefix(
    prefix: string,
    profile: PredictionExperimentProfile,
    limit = DEFAULT_SUGGESTION_LIMIT
  ) {
    const shardData = this.loadShardData(toShardPrefix(prefix));
    const cacheKey = `${profile.id}:${prefix}`;
    if (!shardData.prefixCache.has(cacheKey)) {
      const matches = shardData.entries.filter((entry) => entry.itrans.startsWith(prefix));
      const continuationBranchCounts =
        profile.continuationBranchPenalty > 0
          ? matches.reduce((counts, entry) => {
              const branchKey = getContinuationBranchKey(entry, prefix, profile);
              if (branchKey) {
                counts.set(branchKey, (counts.get(branchKey) ?? 0) + 1);
              }

              return counts;
            }, new Map<string, number>())
          : undefined;
      const bucket: RuntimeLexiconEntry[] = [];
      for (const entry of matches) {
        insertSuggestion(bucket, entry, prefix, profile, this.sourceIndex, continuationBranchCounts);
      }
      shardData.prefixCache.set(cacheKey, bucket);
    }

    return (shardData.prefixCache.get(cacheKey) ?? []).slice(0, limit);
  }

  getSuggestions(
    prefix: string,
    profile: PredictionExperimentProfile,
    limit = DEFAULT_SUGGESTION_LIMIT
  ) {
    const normalizedPrefix = normalizeForLexicalLookup(prefix);
    if (normalizedPrefix.length < MIN_LOOKUP_PREFIX_LENGTH) {
      return [] as RuntimeLexiconEntry[];
    }

    return this.getSuggestionsForNormalizedPrefix(normalizedPrefix, profile, limit);
  }

  hasEntry(itrans: string) {
    const normalized = normalizeForLexicalLookup(itrans);
    if (normalized.length < MIN_LOOKUP_PREFIX_LENGTH) {
      return false;
    }

    return this.loadShardData(toShardPrefix(normalized)).entrySet.has(normalized);
  }
}

const createEmptyMetrics = (): PrefixMetrics => ({
  queries: 0,
  top1Hits: 0,
  top3Hits: 0,
  top5Hits: 0,
});

const resolveEvaluationDataset = (datasetId: string): EvaluatableDataset => {
  const dataset = resolveCorpusDataset(datasetId);
  if (dataset.format !== 'ndjson-records' || !dataset.canonical) {
    throw new Error(`Dataset "${datasetId}" is not an ndjson canonical dataset and cannot be evaluated.`);
  }

  return dataset as EvaluatableDataset;
};

export const prepareDatasetEvaluationInput = async ({
  datasetId,
}: {
  datasetId: string;
}): Promise<PreparedDatasetEvaluation> => {
  const dataset = resolveEvaluationDataset(datasetId);
  const canonicalConfig = dataset.canonical;
  const queryMap = new Map<string, PreparedEvaluationQuery>();

  let rowCount = 0;
  let skippedRows = 0;
  let eligibleWords = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(dataset.path, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    rowCount += 1;
    const row = JSON.parse(line) as Record<string, unknown>;
    const rowId = String(row[canonicalConfig.idField ?? 'id'] ?? `${dataset.id}:${rowCount}`);
    const record = processCanonicalRow({
      row,
      config: canonicalConfig,
      rowId,
      datasetId: dataset.id,
    });

    if (!record) {
      skippedRows += 1;
      continue;
    }

    const target = normalizeForLexicalLookup(record.itrans);
    if (target.length < MIN_LOOKUP_PREFIX_LENGTH) {
      skippedRows += 1;
      continue;
    }

    eligibleWords += 1;
    const existing = queryMap.get(target);
    if (existing) {
      existing.weight += 1;
    } else {
      queryMap.set(target, {
        rowId,
        target,
        devanagari: record.devanagari,
        weight: 1,
      });
    }
  }

  return {
    datasetId: dataset.id,
    datasetLabel: CORPUS_DATASETS[dataset.id].label,
    rowCount,
    skippedRows,
    eligibleWords,
    queries: Array.from(queryMap.values()),
  };
};

export const prepareDatasetEvaluationInputCached = async ({
  datasetId,
  cacheDir,
}: {
  datasetId: string;
  cacheDir: string;
}) => {
  const dataset = resolveEvaluationDataset(datasetId);
  const sourceFingerprint = toFileFingerprint(dataset.path);
  const cachePath = path.join(cacheDir, `${datasetId}.prepared.json`);

  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CachedPreparedDatasetEvaluation;
      if (
        cached.version === PREPARED_DATASET_CACHE_VERSION &&
        fingerprintsMatch(cached.source, sourceFingerprint)
      ) {
        return cached.prepared;
      }
    } catch {
      // Ignore stale or malformed cache and rebuild below.
    }
  }

  const prepared = await prepareDatasetEvaluationInput({ datasetId });
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    cachePath,
    `${JSON.stringify(
      {
        version: PREPARED_DATASET_CACHE_VERSION,
        source: sourceFingerprint,
        prepared,
      } satisfies CachedPreparedDatasetEvaluation,
      null,
      2
    )}\n`,
    'utf8'
  );

  return prepared;
};

export const evaluatePreparedLexicalPredictions = ({
  prepared,
  lexicon,
  profileId = 'baseline',
}: {
  prepared: PreparedDatasetEvaluation;
  lexicon: DiskRuntimeLexicon;
  profileId?: string;
}): DatasetEvaluationResult => {
  const profile = resolvePredictionExperimentProfile(profileId);
  const finalPrefixMetrics = createEmptyMetrics();
  const allPrefixesMetrics = createEmptyMetrics();
  const sampleMisses: MissSample[] = [];
  let inLexiconWords = 0;
  let missingWords = 0;

  for (const query of prepared.queries) {
    const { rowId, target, devanagari, weight } = query;

    if (lexicon.hasEntry(target)) {
      inLexiconWords += weight;
    } else {
      missingWords += weight;
    }

    const finalPrefixLength = Math.max(MIN_LOOKUP_PREFIX_LENGTH, target.length - 1);
    for (let prefixLength = MIN_LOOKUP_PREFIX_LENGTH; prefixLength <= finalPrefixLength; prefixLength += 1) {
      const prefix = target.slice(0, prefixLength);
      const suggestions = lexicon.getSuggestions(prefix, profile, DEFAULT_SUGGESTION_LIMIT);
      incrementMetric(allPrefixesMetrics, suggestions, target, weight);

      if (prefixLength === finalPrefixLength) {
        incrementMetric(finalPrefixMetrics, suggestions, target, weight);
      }

      const hit = suggestions.slice(0, DEFAULT_SUGGESTION_LIMIT).some((entry) => entry.itrans === target);
      if (!hit && sampleMisses.length < MAX_SAMPLED_MISSES) {
        sampleMisses.push({
          datasetId: prepared.datasetId,
          rowId,
          prefix,
          target,
          devanagari,
          suggestions: suggestions.map((entry) => entry.itrans),
        });
      }
    }
  }

  return {
    profileId: profile.id,
    datasetId: prepared.datasetId,
    datasetLabel: prepared.datasetLabel,
    rowCount: prepared.rowCount,
    skippedRows: prepared.skippedRows,
    eligibleWords: prepared.eligibleWords,
    inLexiconWords,
    missingWords,
    prefixMetrics: {
      finalPrefix: finalPrefixMetrics,
      allPrefixes: allPrefixesMetrics,
    },
    sampleMisses,
  };
};

export const evaluateLexicalPredictionsForDataset = async ({
  dataRoot,
  datasetId,
  profileId = 'baseline',
  cacheDir,
}: {
  dataRoot: string;
  datasetId: string;
  profileId?: string;
  cacheDir?: string;
}): Promise<DatasetEvaluationResult> => {
  const profile = resolvePredictionExperimentProfile(profileId);
  const sourceIndex = profile.sourceWeights
    ? cacheDir
      ? await buildRuntimeLexiconSourceIndexCached({ dataRoot, cacheDir })
      : await buildRuntimeLexiconSourceIndex(dataRoot)
    : undefined;
  const lexicon = new DiskRuntimeLexicon(dataRoot, sourceIndex);
  const prepared = cacheDir
    ? await prepareDatasetEvaluationInputCached({ datasetId, cacheDir })
    : await prepareDatasetEvaluationInput({ datasetId });
  return evaluatePreparedLexicalPredictions({
    prepared,
    lexicon,
    profileId: profile.id,
  });
};
