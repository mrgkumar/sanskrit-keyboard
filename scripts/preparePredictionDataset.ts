import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { processCanonicalRow } from './buildCanonicalLexiconShared.ts';
import { normalizeForLexicalLookup } from '../src/lib/vedic/lexicalNormalization.ts';
import { CORPUS_DATASETS, resolveCorpusDataset } from '../test-support/corpusRegistry.ts';

const MIN_LOOKUP_PREFIX_LENGTH = 2;
const CACHE_VERSION = 1;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    datasets: ['san-train'],
    cacheDir: path.resolve(process.cwd(), '..', 'generated', 'autocomplete', 'experiments', 'cache'),
    limit: null as number | null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--datasets' && next) {
      options.datasets = next
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      index += 1;
      continue;
    }

    if (arg === '--cache-dir' && next) {
      options.cacheDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--limit' && next) {
      options.limit = Number.parseInt(next, 10);
      index += 1;
    }
  }

  return options;
};

const buildPreparedDataset = async (datasetId: string, limit: number | null) => {
  const dataset = resolveCorpusDataset(datasetId);
  if (dataset.format !== 'ndjson-records' || !dataset.canonical) {
    throw new Error(`Dataset "${datasetId}" cannot be prepared for lexical evaluation.`);
  }

  const queryMap = new Map<string, { rowId: string; target: string; devanagari: string; weight: number }>();
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
    const rowId = String(row[dataset.canonical.idField ?? 'id'] ?? `${dataset.id}:${rowCount}`);
    const record = processCanonicalRow({
      row,
      config: dataset.canonical,
      rowId,
      datasetId: dataset.id,
    });

    if (!record) {
      skippedRows += 1;
      if (limit && rowCount >= limit) {
        break;
      }
      continue;
    }

    const target = normalizeForLexicalLookup(record.itrans);
    if (target.length < MIN_LOOKUP_PREFIX_LENGTH) {
      skippedRows += 1;
      if (limit && rowCount >= limit) {
        break;
      }
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

    if (limit && rowCount >= limit) {
      break;
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

const main = async () => {
  const options = parseArgs();
  fs.mkdirSync(options.cacheDir, { recursive: true });

  const prepared = [];
  for (const datasetId of options.datasets) {
    const preparedDataset = await buildPreparedDataset(datasetId, options.limit);
    const suffix = options.limit ? `.limit-${options.limit}` : '';
    const cachePath = path.join(options.cacheDir, `${datasetId}${suffix}.prepared.json`);
    fs.writeFileSync(
      cachePath,
      `${JSON.stringify(
        {
          version: CACHE_VERSION,
          prepared: preparedDataset,
          limitedRows: options.limit,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    prepared.push({
      datasetId: preparedDataset.datasetId,
      eligibleWords: preparedDataset.eligibleWords,
      queryCount: preparedDataset.queries.length,
      cachePath,
    });
  }

  console.log(
    JSON.stringify(
      {
        cacheDir: options.cacheDir,
        limit: options.limit,
        datasets: prepared,
      },
      null,
      2
    )
  );
};

void main();
