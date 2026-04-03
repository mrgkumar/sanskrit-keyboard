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

interface PrefixFailureBreakdown {
  queries: number;
  retrievalFailures: number;
  rankingFailures: number;
}

interface MissSample {
  datasetId: string;
  rowId: string;
  prefix: string;
  target: string;
  devanagari: string;
  suggestions: string[];
  failureType: 'retrieval' | 'ranking';
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
  failureBreakdown: {
    finalPrefix: PrefixFailureBreakdown;
    allPrefixes: PrefixFailureBreakdown;
  };
  sampleMisses: MissSample[];
}

export interface RetrievalSummary {
  eligibleWords: number;
  inLexiconWords: number;
  missingWords: number;
  coverageRate: number;
  finalPrefixQueries: number;
  finalPrefixRetrievalFailures: number;
  finalPrefixRetrievalFailureRate: number;
  allPrefixQueries: number;
  allPrefixRetrievalFailures: number;
  allPrefixRetrievalFailureRate: number;
}

export interface RetrievalGapSample {
  datasetId: string;
  rowId: string;
  target: string;
  devanagari: string;
  deepestSuggestedPrefix: string | null;
  finalPrefix: string;
  finalPrefixSuggestions: string[];
}

export interface RetrievalGapAnalysis {
  profileId: string;
  datasetId: string;
  datasetLabel: string;
  missingWords: number;
  missingWithAnyPrefixSuggestions: number;
  missingWithFinalPrefixSuggestions: number;
  deepestSuggestedPrefixHistogram: Record<string, number>;
  sampleMissingFamilies: RetrievalGapSample[];
}

export type RetrievalMissTaxonomyBucket =
  | 'A_exact_target_absent'
  | 'B_present_but_not_reachable_by_normalization'
  | 'C_family_present_exact_absent'
  | 'D_sandhi_or_compound_variant_mismatch'
  | 'E_segmentation_mismatch'
  | 'F_swara_mark_mismatch'
  | 'G_canonicalization_mismatch'
  | 'H_evaluation_artifact_or_noisy_ground_truth';

export interface RetrievalMissTaxonomyFlags {
  exactTargetAbsent: boolean;
  presentButNormalizationBlocked: boolean;
  familyPresentExactAbsent: boolean;
  sandhiOrCompoundVariantMismatch: boolean;
  segmentationMismatch: boolean;
  swaraMarkMismatch: boolean;
  canonicalizationMismatch: boolean;
  evaluationArtifactOrNoisyGroundTruth: boolean;
}

export interface RetrievalMissTaxonomySample {
  datasetId: string;
  rowId: string;
  target: string;
  devanagari: string;
  weight: number;
  finalPrefix: string;
  finalPrefixSuggestions: string[];
  familyNeighbors: string[];
  alternateCanonicalForms: string[];
  primaryBucket: RetrievalMissTaxonomyBucket;
  confidence: 'high' | 'medium' | 'low';
  flags: RetrievalMissTaxonomyFlags;
}

export interface RetrievalMissTaxonomyAnalysis {
  profileId: string;
  datasetId: string;
  datasetLabel: string;
  missingWords: number;
  bucketCounts: Record<RetrievalMissTaxonomyBucket, number>;
  sampleMisses: RetrievalMissTaxonomySample[];
  limitations: string[];
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

interface CanonicalVariantIndex {
  byDevanagari: Map<string, Set<string>>;
}

const SHARD_PREFIX_LENGTH = 2;
const MIN_LOOKUP_PREFIX_LENGTH = 2;
const MAX_SAMPLED_MISSES = 10;
const MAX_TAXONOMY_SAMPLES = 25;
const DEFAULT_SUGGESTION_LIMIT = 5;
const CANONICAL_MAPPING_FILE = 'canonical-mapping.ndjson';
const PREPARED_DATASET_CACHE_VERSION = 2;
const SOURCE_INDEX_CACHE_VERSION = 1;
const ALLOWED_ITRANS_SIGNS = new Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~:/.^_|'\\");
const ENDING_FAMILIES = [
  'dhvam',
  'bhyam',
  'bhyaH',
  'bhiH',
  'tvam',
  'sva',
  'stu',
  'nti',
  'sii',
  'sya',
  'ena',
  'asya',
  'bhyo',
  'si',
  'se',
  'ti',
  'mi',
  'ma',
  'va',
  'ta',
];

const toFileFingerprint = (filePath: string): FileFingerprint => {
  const stats = fs.statSync(filePath);
  return {
    path: path.resolve(filePath),
    size: stats.size,
    mtimeMs: stats.mtimeMs,
  };
};

const createEmptyBucketCounts = (): Record<RetrievalMissTaxonomyBucket, number> => ({
  A_exact_target_absent: 0,
  B_present_but_not_reachable_by_normalization: 0,
  C_family_present_exact_absent: 0,
  D_sandhi_or_compound_variant_mismatch: 0,
  E_segmentation_mismatch: 0,
  F_swara_mark_mismatch: 0,
  G_canonicalization_mismatch: 0,
  H_evaluation_artifact_or_noisy_ground_truth: 0,
});

const getSharedPrefixLength = (left: string, right: string) => {
  const leftChars = Array.from(left);
  const rightChars = Array.from(right);
  const maxLength = Math.min(leftChars.length, rightChars.length);
  let count = 0;

  while (count < maxLength && leftChars[count] === rightChars[count]) {
    count += 1;
  }

  return count;
};

const buildCanonicalVariantIndex = async (dataRoot: string): Promise<CanonicalVariantIndex> => {
  const canonicalPath = path.join(dataRoot, CANONICAL_MAPPING_FILE);
  const byDevanagari = new Map<string, Set<string>>();

  if (!fs.existsSync(canonicalPath)) {
    return { byDevanagari };
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(canonicalPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const record = JSON.parse(line) as { devanagari?: string; itrans?: string };
    const devanagari = typeof record.devanagari === 'string' ? record.devanagari : '';
    const itrans = typeof record.itrans === 'string' ? normalizeForLexicalLookup(record.itrans) : '';
    if (!devanagari || itrans.length < MIN_LOOKUP_PREFIX_LENGTH) {
      continue;
    }

    const bucket = byDevanagari.get(devanagari) ?? new Set<string>();
    bucket.add(itrans);
    byDevanagari.set(devanagari, bucket);
  }

  return { byDevanagari };
};

const classifyRetrievalMiss = ({
  datasetId,
  query,
  lexicon,
  profile,
  canonicalVariants,
}: {
  datasetId: string;
  query: PreparedEvaluationQuery;
  lexicon: DiskRuntimeLexicon;
  profile: PredictionExperimentProfile;
  canonicalVariants: CanonicalVariantIndex;
}): RetrievalMissTaxonomySample => {
  const finalPrefixLength = Math.max(MIN_LOOKUP_PREFIX_LENGTH, query.target.length - 1);
  const finalPrefix = query.target.slice(0, finalPrefixLength);
  const finalPrefixSuggestions = lexicon.getSuggestions(finalPrefix, profile, DEFAULT_SUGGESTION_LIMIT);
  const familyNeighbors = lexicon
    .getEntriesWithPrefix(finalPrefix)
    .slice(0, 12)
    .map((entry) => entry.itrans);
  const alternateCanonicalForms = [...(canonicalVariants.byDevanagari.get(query.devanagari) ?? new Set<string>())]
    .filter((candidate) => candidate !== query.target)
    .sort((left, right) => left.localeCompare(right));
  const shardNeighbors = lexicon
    .getEntriesForShardValue(query.target)
    .map((entry) => ({
      itrans: entry.itrans,
      sharedPrefixLength: getSharedPrefixLength(query.target, entry.itrans),
    }))
    .filter((entry) => entry.sharedPrefixLength >= Math.min(4, finalPrefix.length))
    .sort((left, right) => {
      if (right.sharedPrefixLength !== left.sharedPrefixLength) {
        return right.sharedPrefixLength - left.sharedPrefixLength;
      }

      return left.itrans.localeCompare(right.itrans);
    });

  const hasFamilyNeighbors = familyNeighbors.length > 0;
  const hasCompoundLikeNeighbor = shardNeighbors.some((entry) => {
    const lengthDelta = Math.abs(entry.itrans.length - query.target.length);
    return (
      query.target.length >= 8 &&
      entry.sharedPrefixLength >= Math.max(4, Math.min(query.target.length, entry.itrans.length) - 2) &&
      lengthDelta >= 3
    );
  });
  const hasSegmentationSignal =
    !hasFamilyNeighbors &&
    shardNeighbors.some((entry) => entry.itrans.includes('/') !== query.target.includes('/'));
  const hasCanonicalizationSignal = alternateCanonicalForms.length > 0;
  const hasEvaluationArtifactSignal = alternateCanonicalForms.length >= 2 && !hasFamilyNeighbors;

  const flags: RetrievalMissTaxonomyFlags = {
    exactTargetAbsent: true,
    presentButNormalizationBlocked: false,
    familyPresentExactAbsent: hasFamilyNeighbors,
    sandhiOrCompoundVariantMismatch: hasCompoundLikeNeighbor,
    segmentationMismatch: hasSegmentationSignal,
    swaraMarkMismatch: false,
    canonicalizationMismatch: hasCanonicalizationSignal,
    evaluationArtifactOrNoisyGroundTruth: hasEvaluationArtifactSignal,
  };

  let primaryBucket: RetrievalMissTaxonomyBucket = 'A_exact_target_absent';
  let confidence: RetrievalMissTaxonomySample['confidence'] = 'high';

  if (flags.canonicalizationMismatch) {
    primaryBucket = 'G_canonicalization_mismatch';
    confidence = 'medium';
  } else if (flags.sandhiOrCompoundVariantMismatch) {
    primaryBucket = 'D_sandhi_or_compound_variant_mismatch';
    confidence = 'medium';
  } else if (flags.segmentationMismatch) {
    primaryBucket = 'E_segmentation_mismatch';
    confidence = 'low';
  } else if (flags.familyPresentExactAbsent) {
    primaryBucket = 'C_family_present_exact_absent';
    confidence = 'high';
  } else if (flags.evaluationArtifactOrNoisyGroundTruth) {
    primaryBucket = 'H_evaluation_artifact_or_noisy_ground_truth';
    confidence = 'low';
  }

  return {
    datasetId,
    rowId: query.rowId,
    target: query.target,
    devanagari: query.devanagari,
    weight: query.weight,
    finalPrefix,
    finalPrefixSuggestions: finalPrefixSuggestions.map((entry) => entry.itrans),
    familyNeighbors,
    alternateCanonicalForms,
    primaryBucket,
    confidence,
    flags,
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

const getEndingFamilyBonus = (entry: RuntimeLexiconEntry, prefix: string, profile: PredictionExperimentProfile) => {
  const bonusWeight = profile.endingFamilyBonus ?? 0;
  if (bonusWeight <= 0) {
    return 0;
  }

  for (const ending of ENDING_FAMILIES) {
    if (!entry.itrans.endsWith(ending)) {
      continue;
    }

    const endingStart = entry.itrans.length - ending.length;
    if (prefix.length < endingStart + 1) {
      continue;
    }

    return ending.length * bonusWeight;
  }

  return 0;
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
  const leftEndingBonus = getEndingFamilyBonus(left, prefix, profile);
  const rightEndingBonus = getEndingFamilyBonus(right, prefix, profile);
  const leftScore =
    leftWeightedCount -
    leftNoisePenalty -
    leftContinuationPenalty -
    (left.itrans.length - prefix.length) * leftPenaltyWeight +
    leftEndingBonus;
  const rightScore =
    rightWeightedCount -
    rightNoisePenalty -
    rightContinuationPenalty -
    (right.itrans.length - prefix.length) * rightPenaltyWeight +
    rightEndingBonus;

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

export const summarizeFailureBreakdown = (breakdown: PrefixFailureBreakdown) => ({
  queries: breakdown.queries,
  retrievalFailures: breakdown.retrievalFailures,
  rankingFailures: breakdown.rankingFailures,
  failureRate: toRate(breakdown.retrievalFailures + breakdown.rankingFailures, breakdown.queries),
  retrievalFailureRate: toRate(breakdown.retrievalFailures, breakdown.queries),
  rankingFailureRate: toRate(breakdown.rankingFailures, breakdown.queries),
});

export const summarizeRetrieval = (result: DatasetEvaluationResult): RetrievalSummary => ({
  eligibleWords: result.eligibleWords,
  inLexiconWords: result.inLexiconWords,
  missingWords: result.missingWords,
  coverageRate: toRate(result.inLexiconWords, result.eligibleWords),
  finalPrefixQueries: result.failureBreakdown.finalPrefix.queries,
  finalPrefixRetrievalFailures: result.failureBreakdown.finalPrefix.retrievalFailures,
  finalPrefixRetrievalFailureRate: toRate(
    result.failureBreakdown.finalPrefix.retrievalFailures,
    result.failureBreakdown.finalPrefix.queries
  ),
  allPrefixQueries: result.failureBreakdown.allPrefixes.queries,
  allPrefixRetrievalFailures: result.failureBreakdown.allPrefixes.retrievalFailures,
  allPrefixRetrievalFailureRate: toRate(
    result.failureBreakdown.allPrefixes.retrievalFailures,
    result.failureBreakdown.allPrefixes.queries
  ),
});

export const analyzePreparedRetrievalGaps = ({
  prepared,
  lexicon,
  profileId = 'baseline',
}: {
  prepared: PreparedDatasetEvaluation;
  lexicon: DiskRuntimeLexicon;
  profileId?: string;
}): RetrievalGapAnalysis => {
  const profile = resolvePredictionExperimentProfile(profileId);
  const deepestSuggestedPrefixHistogram = new Map<string, number>();
  const sampleMissingFamilies: RetrievalGapSample[] = [];
  let missingWords = 0;
  let missingWithAnyPrefixSuggestions = 0;
  let missingWithFinalPrefixSuggestions = 0;

  for (const query of prepared.queries) {
    const inLexicon = lexicon.hasEntry(query.target);
    if (inLexicon) {
      continue;
    }
    missingWords += query.weight;

    const finalPrefixLength = Math.max(MIN_LOOKUP_PREFIX_LENGTH, query.target.length - 1);
    let deepestSuggestedPrefixLength = 0;
    let finalPrefixSuggestions: string[] = [];

    for (let prefixLength = MIN_LOOKUP_PREFIX_LENGTH; prefixLength <= finalPrefixLength; prefixLength += 1) {
      const prefix = query.target.slice(0, prefixLength);
      const suggestions = lexicon.getSuggestions(prefix, profile, DEFAULT_SUGGESTION_LIMIT);
      if (suggestions.length > 0) {
        deepestSuggestedPrefixLength = prefixLength;
      }

      if (prefixLength === finalPrefixLength) {
        finalPrefixSuggestions = suggestions.map((entry) => entry.itrans);
      }
    }

    if (deepestSuggestedPrefixLength > 0) {
      missingWithAnyPrefixSuggestions += query.weight;
    }

    if (finalPrefixSuggestions.length > 0) {
      missingWithFinalPrefixSuggestions += query.weight;
    }

    const histogramKey =
      deepestSuggestedPrefixLength > 0 ? String(deepestSuggestedPrefixLength) : 'none';
    deepestSuggestedPrefixHistogram.set(
      histogramKey,
      (deepestSuggestedPrefixHistogram.get(histogramKey) ?? 0) + query.weight
    );

    if (sampleMissingFamilies.length < MAX_SAMPLED_MISSES) {
      sampleMissingFamilies.push({
        datasetId: prepared.datasetId,
        rowId: query.rowId,
        target: query.target,
        devanagari: query.devanagari,
        deepestSuggestedPrefix:
          deepestSuggestedPrefixLength > 0 ? query.target.slice(0, deepestSuggestedPrefixLength) : null,
        finalPrefix: query.target.slice(0, finalPrefixLength),
        finalPrefixSuggestions,
      });
    }
  }

  return {
    profileId: profile.id,
    datasetId: prepared.datasetId,
    datasetLabel: prepared.datasetLabel,
    missingWords,
    missingWithAnyPrefixSuggestions,
    missingWithFinalPrefixSuggestions,
    deepestSuggestedPrefixHistogram: Object.fromEntries(
      [...deepestSuggestedPrefixHistogram.entries()].sort(([left], [right]) => {
        if (left === 'none') {
          return 1;
        }
        if (right === 'none') {
          return -1;
        }
        return Number(left) - Number(right);
      })
    ),
    sampleMissingFamilies,
  };
};

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

  getEntriesWithPrefix(prefix: string) {
    const normalizedPrefix = normalizeForLexicalLookup(prefix);
    if (normalizedPrefix.length < MIN_LOOKUP_PREFIX_LENGTH) {
      return [] as RuntimeLexiconEntry[];
    }

    return this.loadShardData(toShardPrefix(normalizedPrefix)).entries.filter((entry) => entry.itrans.startsWith(normalizedPrefix));
  }

  getEntriesForShardValue(value: string) {
    const normalized = normalizeForLexicalLookup(value);
    if (normalized.length < MIN_LOOKUP_PREFIX_LENGTH) {
      return [] as RuntimeLexiconEntry[];
    }

    return [...this.loadShardData(toShardPrefix(normalized)).entries];
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

const createEmptyFailureBreakdown = (): PrefixFailureBreakdown => ({
  queries: 0,
  retrievalFailures: 0,
  rankingFailures: 0,
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
  const finalPrefixFailures = createEmptyFailureBreakdown();
  const allPrefixesFailures = createEmptyFailureBreakdown();
  const sampleMisses: MissSample[] = [];
  let inLexiconWords = 0;
  let missingWords = 0;

  for (const query of prepared.queries) {
    const { rowId, target, devanagari, weight } = query;

    const inLexicon = lexicon.hasEntry(target);
    if (inLexicon) {
      inLexiconWords += weight;
    } else {
      missingWords += weight;
    }

    const finalPrefixLength = Math.max(MIN_LOOKUP_PREFIX_LENGTH, target.length - 1);
    for (let prefixLength = MIN_LOOKUP_PREFIX_LENGTH; prefixLength <= finalPrefixLength; prefixLength += 1) {
      const prefix = target.slice(0, prefixLength);
      const suggestions = lexicon.getSuggestions(prefix, profile, DEFAULT_SUGGESTION_LIMIT);
      incrementMetric(allPrefixesMetrics, suggestions, target, weight);
      allPrefixesFailures.queries += weight;

      if (prefixLength === finalPrefixLength) {
        incrementMetric(finalPrefixMetrics, suggestions, target, weight);
        finalPrefixFailures.queries += weight;
      }

      const hit = suggestions.slice(0, DEFAULT_SUGGESTION_LIMIT).some((entry) => entry.itrans === target);
      const failureType = inLexicon ? 'ranking' : 'retrieval';
      if (!hit) {
        if (inLexicon) {
          allPrefixesFailures.rankingFailures += weight;
        } else {
          allPrefixesFailures.retrievalFailures += weight;
        }
      }

      if (!hit && prefixLength === finalPrefixLength) {
        if (inLexicon) {
          finalPrefixFailures.rankingFailures += weight;
        } else {
          finalPrefixFailures.retrievalFailures += weight;
        }
      }

      if (!hit && sampleMisses.length < MAX_SAMPLED_MISSES) {
        sampleMisses.push({
          datasetId: prepared.datasetId,
          rowId,
          prefix,
          target,
          devanagari,
          suggestions: suggestions.map((entry) => entry.itrans),
          failureType,
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
    failureBreakdown: {
      finalPrefix: finalPrefixFailures,
      allPrefixes: allPrefixesFailures,
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

export const analyzePreparedRetrievalMissTaxonomy = async ({
  prepared,
  lexicon,
  dataRoot,
  profileId = 'baseline',
}: {
  prepared: PreparedDatasetEvaluation;
  lexicon: DiskRuntimeLexicon;
  dataRoot: string;
  profileId?: string;
}): Promise<RetrievalMissTaxonomyAnalysis> => {
  const profile = resolvePredictionExperimentProfile(profileId);
  const canonicalVariants = await buildCanonicalVariantIndex(dataRoot);
  const bucketCounts = createEmptyBucketCounts();
  const sampleMisses: RetrievalMissTaxonomySample[] = [];
  let missingWords = 0;

  for (const query of prepared.queries) {
    if (lexicon.hasEntry(query.target)) {
      continue;
    }

    missingWords += query.weight;
    const classified = classifyRetrievalMiss({
      datasetId: prepared.datasetId,
      query,
      lexicon,
      profile,
      canonicalVariants,
    });
    bucketCounts[classified.primaryBucket] += query.weight;

    if (sampleMisses.length < MAX_TAXONOMY_SAMPLES) {
      sampleMisses.push({
        ...classified,
        datasetId: prepared.datasetId,
      });
    }
  }

  return {
    profileId: profile.id,
    datasetId: prepared.datasetId,
    datasetLabel: prepared.datasetLabel,
    missingWords,
    bucketCounts,
    sampleMisses,
    limitations: [
      'Prepared evaluation queries are already normalized for lexical lookup, so B_present_but_not_reachable_by_normalization and F_swara_mark_mismatch are under-observed in this audit.',
      'D_sandhi_or_compound_variant_mismatch and E_segmentation_mismatch are heuristic buckets inferred from neighbor structure, not morphological ground truth.',
      'G_canonicalization_mismatch is inferred from alternate canonical ITRANS forms for the same Devanagari surface in canonical-mapping.ndjson.',
    ],
  };
};
