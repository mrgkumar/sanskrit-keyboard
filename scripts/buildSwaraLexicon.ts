import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

import {
  extractSwaraRecordText,
  parseDatasetIds,
  resolveCorpusDatasets,
  type CorpusDataset,
} from '../test-support/corpusRegistry.ts';
import { tokenizeDevanagariText } from '../test-support/corpusText.ts';
import {
  hasLexicalSvaraMarkers,
  normalizeForLexicalLookup,
} from '../src/lib/vedic/lexicalNormalization.ts';
import { detransliterate } from '../src/lib/vedic/utils.ts';

interface SwaraVariantRecord {
  count: number;
  devanagari: string;
}

interface SwaraLexiconEntry {
  normalized: string;
  variants: Array<{
    itrans: string;
    devanagari: string;
    count: number;
  }>;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_INPUT_PATH = path.resolve(APP_ROOT, '../archive/example.txt');
const DEFAULT_OUTPUT_PATH = path.resolve(APP_ROOT, 'test-support/fixtures/autocomplete/swara-lexicon.json');

const shouldLookupLexicalSuggestions = (value: string) =>
  value.length >= 2 && /[A-Za-z]/.test(value);

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT_PATH,
    datasets: [] as string[],
    output: DEFAULT_OUTPUT_PATH,
    limit: null as number | null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input' && next) {
      options.input = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--datasets' && next) {
      options.datasets = parseDatasetIds(next);
      index += 1;
      continue;
    }

    if (arg === '--output' && next) {
      options.output = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--limit' && next) {
      const parsed = Number.parseInt(next, 10);
      options.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      index += 1;
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  const datasets: CorpusDataset[] =
    options.datasets.length > 0
      ? resolveCorpusDatasets(options.datasets)
      : [
          {
            id: 'legacy-input',
            label: 'Legacy input',
            format: 'devanagari-text',
            path: options.input,
            swara: { enabled: true as const },
          },
        ];
  const tokens: string[] = [];

  for (const dataset of datasets) {
    if (dataset.format === 'devanagari-text') {
      const source = fs.readFileSync(dataset.path, 'utf8');
      tokens.push(...tokenizeDevanagariText(source));
    } else if (dataset.format === 'ndjson-records' && dataset.swara) {
      const rl = readline.createInterface({
        input: fs.createReadStream(dataset.path, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      });

      try {
        for await (const line of rl) {
          if (options.limit !== null && tokens.length >= options.limit) {
            break;
          }

          if (!line.trim()) {
            continue;
          }

          const row = JSON.parse(line) as Record<string, unknown>;
          const text = extractSwaraRecordText(dataset, row);
          if (text) {
            tokens.push(...tokenizeDevanagariText(text));
          }
        }
      } finally {
        rl.close();
      }
    }

    if (options.limit !== null && tokens.length >= options.limit) {
      tokens.length = options.limit;
      break;
    }
  }

  const variantsByNormalized = new Map<string, Map<string, SwaraVariantRecord>>();

  for (const token of tokens) {
    const itrans = detransliterate(token);
    const normalized = normalizeForLexicalLookup(itrans);

    if (!shouldLookupLexicalSuggestions(normalized) || !hasLexicalSvaraMarkers(itrans)) {
      continue;
    }

    const entry = variantsByNormalized.get(normalized) ?? new Map<string, SwaraVariantRecord>();
    const existing = entry.get(itrans);
    if (existing) {
      existing.count += 1;
    } else {
      entry.set(itrans, {
        count: 1,
        devanagari: token,
      });
    }
    variantsByNormalized.set(normalized, entry);
  }

  const entries: SwaraLexiconEntry[] = [...variantsByNormalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalized, variants]) => ({
      normalized,
      variants: [...variants.entries()]
        .map(([itrans, record]) => ({
          itrans,
          devanagari: record.devanagari,
          count: record.count,
        }))
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.itrans.localeCompare(right.itrans);
        }),
    }));

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(
    options.output,
    `${JSON.stringify(
      {
        version: 1,
        inputPaths: datasets.map((dataset) => dataset.path),
        datasetIds: datasets.map((dataset) => dataset.id),
        entryCount: entries.length,
        entries,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        inputPath: options.input,
        datasetIds: datasets.map((dataset) => dataset.id),
        outputPath: options.output,
        tokenCount: tokens.length,
        entryCount: entries.length,
      },
      null,
      2
    )
  );
};

main();
