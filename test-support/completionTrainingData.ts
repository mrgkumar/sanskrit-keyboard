import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { normalizeForLexicalLookup } from '../src/lib/vedic/lexicalNormalization.ts';

export interface CanonicalTrainingRecord {
  devanagari: string;
  itrans: string;
  source?: string | null;
}

interface SwaraVariantRecord {
  itrans: string;
  devanagari: string;
  count: number;
}

interface SwaraLexiconFile {
  version: number;
  entries: Array<{
    normalized: string;
    variants: SwaraVariantRecord[];
  }>;
}

export interface CompletionTableEntry {
  canonicalItransWord: string;
  sanskritWord: string;
  normalizedLookupKey: string;
  frequency: number;
  source: string;
  sourceWeightClass: 'core' | 'secondary' | 'unknown';
  sources: Array<{
    source: string;
    count: number;
  }>;
  lengthChars: number;
  lengthAksharas: number;
  hasSwara: boolean;
  swaraExactForms: SwaraVariantRecord[];
}

export interface CompletionPrefixExample {
  prefix: string;
  targetWord: string;
  targetSanskrit: string;
  frequency: number;
  source: string;
  sourceWeightClass: 'core' | 'secondary' | 'unknown';
  targetLengthChars: number;
  targetLengthAksharas: number;
  hasSwara: boolean;
}

interface AggregatedEntryState {
  canonicalItransWord: string;
  normalizedLookupKey: string;
  frequency: number;
  devanagariCounts: Map<string, number>;
  sourceCounts: Map<string, number>;
}

export interface CompletionTrainingSummary {
  inputPath: string;
  swaraPath: string | null;
  outputDir: string;
  processedRows: number;
  entryCount: number;
  prefixExampleCount: number;
}

interface BucketedAggregationOptions {
  canonicalPath: string;
  outputDir: string;
  tempBucketDir: string;
  swaraPath: string | null;
  limit: number | null;
  bucketPrefixLength?: number;
}

const MIN_PREFIX_LENGTH = 1;
const DEFAULT_BUCKET_PREFIX_LENGTH = 2;

const classifySourceWeight = (source: string): CompletionTableEntry['sourceWeightClass'] => {
  if (source.startsWith('san-')) {
    return 'core';
  }

  if (source === 'example-vedic') {
    return 'secondary';
  }

  return source === 'unknown' ? 'unknown' : 'secondary';
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const removeDirIfPresent = (dirPath: string) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

const waitForDrain = (stream: fs.WriteStream) =>
  new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });

const waitForFinish = (stream: fs.WriteStream) =>
  new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

const toBucketPrefix = (value: string, prefixLength: number) =>
  Array.from(value).slice(0, prefixLength).join('') || '_';

const encodeBucketKey = (value: string) =>
  Array.from(value)
    .map((char) => char.codePointAt(0)!.toString(16).padStart(4, '0'))
    .join('-');

const countAksharas = (value: string) => {
  if (!value) {
    return 0;
  }

  const segmenter = new Intl.Segmenter('sa', { granularity: 'grapheme' });
  let count = 0;
  for (const segment of segmenter.segment(value)) {
    if (segment.segment.trim()) {
      count += 1;
    }
  }
  return count;
};

const toSortedSources = (sourceCounts: Map<string, number>) =>
  [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.source.localeCompare(right.source);
    });

const toRepresentativeSanskrit = (counts: Map<string, number>) =>
  [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  })[0]?.[0] ?? '';

export const loadSwaraExactForms = (swaraPath: string | null) => {
  if (!swaraPath || !fs.existsSync(swaraPath)) {
    return new Map<string, SwaraVariantRecord[]>();
  }

  const file = JSON.parse(fs.readFileSync(swaraPath, 'utf8')) as SwaraLexiconFile;
  return new Map(
    file.entries.map((entry) => [
      entry.normalized,
      [...entry.variants].sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }

        return left.itrans.localeCompare(right.itrans);
      }),
    ])
  );
};

const aggregateBucketEntries = async ({
  bucketPath,
  swaraExactForms,
}: {
  bucketPath: string;
  swaraExactForms: Map<string, SwaraVariantRecord[]>;
}) => {
  const aggregated = new Map<string, AggregatedEntryState>();
  const rl = readline.createInterface({
    input: fs.createReadStream(bucketPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    const record = JSON.parse(line) as CanonicalTrainingRecord;
    const normalizedLookupKey = normalizeForLexicalLookup(record.itrans);
    if (!normalizedLookupKey) {
      continue;
    }

    const source = record.source ?? 'unknown';
    const current = aggregated.get(record.itrans) ?? {
      canonicalItransWord: record.itrans,
      normalizedLookupKey,
      frequency: 0,
      devanagariCounts: new Map<string, number>(),
      sourceCounts: new Map<string, number>(),
    };

    current.frequency += 1;
    current.devanagariCounts.set(record.devanagari, (current.devanagariCounts.get(record.devanagari) ?? 0) + 1);
    current.sourceCounts.set(source, (current.sourceCounts.get(source) ?? 0) + 1);
    aggregated.set(record.itrans, current);
  }

  return [...aggregated.values()]
    .map((entry): CompletionTableEntry => {
      const sources = toSortedSources(entry.sourceCounts);
      const primarySource = sources[0]?.source ?? 'unknown';
      const sanskritWord = toRepresentativeSanskrit(entry.devanagariCounts);
      const swaraVariants = swaraExactForms.get(entry.normalizedLookupKey) ?? [];

      return {
        canonicalItransWord: entry.canonicalItransWord,
        sanskritWord,
        normalizedLookupKey: entry.normalizedLookupKey,
        frequency: entry.frequency,
        source: primarySource,
        sourceWeightClass: classifySourceWeight(primarySource),
        sources,
        lengthChars: Array.from(entry.canonicalItransWord).length,
        lengthAksharas: countAksharas(sanskritWord),
        hasSwara: swaraVariants.length > 0,
        swaraExactForms: swaraVariants,
      };
    })
    .sort((left, right) => left.canonicalItransWord.localeCompare(right.canonicalItransWord));
};

export const buildCompletionTable = ({
  canonicalRecords,
  swaraExactForms,
}: {
  canonicalRecords: CanonicalTrainingRecord[];
  swaraExactForms?: Map<string, SwaraVariantRecord[]>;
}) => {
  const aggregated = new Map<string, AggregatedEntryState>();

  for (const record of canonicalRecords) {
    const normalizedLookupKey = normalizeForLexicalLookup(record.itrans);
    if (!normalizedLookupKey) {
      continue;
    }

    const source = record.source ?? 'unknown';
    const current = aggregated.get(record.itrans) ?? {
      canonicalItransWord: record.itrans,
      normalizedLookupKey,
      frequency: 0,
      devanagariCounts: new Map<string, number>(),
      sourceCounts: new Map<string, number>(),
    };

    current.frequency += 1;
    current.devanagariCounts.set(record.devanagari, (current.devanagariCounts.get(record.devanagari) ?? 0) + 1);
    current.sourceCounts.set(source, (current.sourceCounts.get(source) ?? 0) + 1);
    aggregated.set(record.itrans, current);
  }

  return [...aggregated.values()]
    .map((entry): CompletionTableEntry => {
      const sources = toSortedSources(entry.sourceCounts);
      const primarySource = sources[0]?.source ?? 'unknown';
      const sanskritWord = toRepresentativeSanskrit(entry.devanagariCounts);
      const swaraVariants = swaraExactForms?.get(entry.normalizedLookupKey) ?? [];

      return {
        canonicalItransWord: entry.canonicalItransWord,
        sanskritWord,
        normalizedLookupKey: entry.normalizedLookupKey,
        frequency: entry.frequency,
        source: primarySource,
        sourceWeightClass: classifySourceWeight(primarySource),
        sources,
        lengthChars: Array.from(entry.canonicalItransWord).length,
        lengthAksharas: countAksharas(sanskritWord),
        hasSwara: swaraVariants.length > 0,
        swaraExactForms: swaraVariants,
      };
    })
    .sort((left, right) => {
      if (right.frequency !== left.frequency) {
        return right.frequency - left.frequency;
      }

      return left.canonicalItransWord.localeCompare(right.canonicalItransWord);
    });
};

export const buildCompletionPrefixExamples = (entries: CompletionTableEntry[]) => {
  const examples: CompletionPrefixExample[] = [];

  for (const entry of entries) {
    const chars = Array.from(entry.canonicalItransWord);
    for (let prefixLength = MIN_PREFIX_LENGTH; prefixLength < chars.length; prefixLength += 1) {
      examples.push({
        prefix: chars.slice(0, prefixLength).join(''),
        targetWord: entry.canonicalItransWord,
        targetSanskrit: entry.sanskritWord,
        frequency: entry.frequency,
        source: entry.source,
        sourceWeightClass: entry.sourceWeightClass,
        targetLengthChars: entry.lengthChars,
        targetLengthAksharas: entry.lengthAksharas,
        hasSwara: entry.hasSwara,
      });
    }
  }

  return examples;
};

export const loadCanonicalTrainingRecords = async (canonicalPath: string, limit: number | null) => {
  const records: CanonicalTrainingRecord[] = [];
  let processedRows = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(canonicalPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    processedRows += 1;
    const record = JSON.parse(line) as CanonicalTrainingRecord;
    records.push(record);

    if (limit !== null && processedRows >= limit) {
      break;
    }
  }

  return {
    processedRows,
    records,
  };
};

export const writeCompletionTrainingArtifacts = async ({
  outputDir,
  completionTable,
  prefixExamples,
  summary,
}: {
  outputDir: string;
  completionTable: CompletionTableEntry[];
  prefixExamples: CompletionPrefixExample[];
  summary: CompletionTrainingSummary;
}) => {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, 'completion-table.json'),
    `${JSON.stringify(
      {
        version: 1,
        entryCount: completionTable.length,
        entries: completionTable,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  const prefixPath = path.join(outputDir, 'completion-prefixes.ndjson');
  const prefixStream = fs.createWriteStream(prefixPath, { encoding: 'utf8' });
  const finished = new Promise<void>((resolve, reject) => {
    prefixStream.on('finish', () => resolve());
    prefixStream.on('error', reject);
  });
  for (const example of prefixExamples) {
    prefixStream.write(`${JSON.stringify(example)}\n`);
  }
  prefixStream.end();
  await finished;

  fs.writeFileSync(
    path.join(outputDir, 'completion-training-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );
};

export const buildCompletionTrainingArtifactsFromCanonicalFile = async ({
  canonicalPath,
  outputDir,
  tempBucketDir,
  swaraPath,
  limit,
  bucketPrefixLength = DEFAULT_BUCKET_PREFIX_LENGTH,
}: BucketedAggregationOptions) => {
  removeDirIfPresent(tempBucketDir);
  ensureDir(tempBucketDir);
  ensureDir(outputDir);

  const bucketStreams = new Map<string, fs.WriteStream>();
  const swaraExactForms = loadSwaraExactForms(swaraPath);
  let processedRows = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(canonicalPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    processedRows += 1;
    const record = JSON.parse(line) as CanonicalTrainingRecord;
    const bucketPrefix = toBucketPrefix(record.itrans, bucketPrefixLength);
    const bucketFile = path.join(tempBucketDir, `${encodeBucketKey(bucketPrefix)}.ndjson`);

    if (!bucketStreams.has(bucketFile)) {
      bucketStreams.set(bucketFile, fs.createWriteStream(bucketFile, { encoding: 'utf8' }));
    }

    const stream = bucketStreams.get(bucketFile)!;
    if (!stream.write(`${line}\n`)) {
      await waitForDrain(stream);
    }

    if (limit !== null && processedRows >= limit) {
      break;
    }
  }

  for (const stream of bucketStreams.values()) {
    stream.end();
    await waitForFinish(stream);
  }

  const bucketFiles = [...bucketStreams.keys()].sort((left, right) => left.localeCompare(right));
  const completionTablePath = path.join(outputDir, 'completion-table.json');
  const prefixPath = path.join(outputDir, 'completion-prefixes.ndjson');
  const tableStream = fs.createWriteStream(completionTablePath, { encoding: 'utf8' });
  const prefixStream = fs.createWriteStream(prefixPath, { encoding: 'utf8' });

  let entryCount = 0;
  let prefixExampleCount = 0;
  let wroteTableEntry = false;

  tableStream.write('{\n');
  tableStream.write('  "version": 1,\n');
  tableStream.write('  "entries": [\n');

  for (const bucketFile of bucketFiles) {
    const entries = await aggregateBucketEntries({
      bucketPath: bucketFile,
      swaraExactForms,
    });

    for (const entry of entries) {
      const serializedEntry = JSON.stringify(entry);
      const tablePrefix = wroteTableEntry ? ',\n    ' : '    ';
      if (!tableStream.write(`${tablePrefix}${serializedEntry}`)) {
        await waitForDrain(tableStream);
      }
      wroteTableEntry = true;
      entryCount += 1;

      const chars = Array.from(entry.canonicalItransWord);
      for (let prefixLength = MIN_PREFIX_LENGTH; prefixLength < chars.length; prefixLength += 1) {
        const example: CompletionPrefixExample = {
          prefix: chars.slice(0, prefixLength).join(''),
          targetWord: entry.canonicalItransWord,
          targetSanskrit: entry.sanskritWord,
          frequency: entry.frequency,
          source: entry.source,
          sourceWeightClass: entry.sourceWeightClass,
          targetLengthChars: entry.lengthChars,
          targetLengthAksharas: entry.lengthAksharas,
          hasSwara: entry.hasSwara,
        };

        if (!prefixStream.write(`${JSON.stringify(example)}\n`)) {
          await waitForDrain(prefixStream);
        }
        prefixExampleCount += 1;
      }
    }
  }

  tableStream.write('\n  ],\n');
  tableStream.write(`  "entryCount": ${entryCount}\n`);
  tableStream.write('}\n');
  tableStream.end();
  prefixStream.end();
  await Promise.all([waitForFinish(tableStream), waitForFinish(prefixStream)]);

  const summary: CompletionTrainingSummary = {
    inputPath: canonicalPath,
    swaraPath,
    outputDir,
    processedRows,
    entryCount,
    prefixExampleCount,
  };
  fs.writeFileSync(
    path.join(outputDir, 'completion-training-summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );

  removeDirIfPresent(tempBucketDir);
  return summary;
};
