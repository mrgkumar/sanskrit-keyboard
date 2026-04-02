import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

import { sanitizeDevanagariCorpusToken } from './corpusText';

export interface SanTrainSample {
  id: string;
  token: string;
  index: number;
}

const DEFAULT_SAMPLE_LIMIT = 2000;
const sanTrainPath = path.resolve(process.cwd(), '../data_corpus/san/san_train.json');

let cachedSamplesPromise: Promise<SanTrainSample[]> | null = null;

export const loadSanTrainSamples = async (
  limit = DEFAULT_SAMPLE_LIMIT
): Promise<SanTrainSample[]> => {
  if (limit === DEFAULT_SAMPLE_LIMIT && cachedSamplesPromise) {
    return cachedSamplesPromise;
  }

  const loadPromise = (async () => {
    const stream = fs.createReadStream(sanTrainPath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    const samples: SanTrainSample[] = [];
    let rowIndex = 0;

    try {
      for await (const line of rl) {
        rowIndex += 1;
        if (!line.trim()) {
          continue;
        }

        const row = JSON.parse(line) as Record<string, unknown>;
        const rawToken = typeof row['native word'] === 'string' ? row['native word'].trim() : '';
        const token = sanitizeDevanagariCorpusToken(rawToken);
        if (!token) {
          continue;
        }

        samples.push({
          id:
            typeof row.unique_identifier === 'string' && row.unique_identifier.trim()
              ? row.unique_identifier.trim()
              : `san-train-${rowIndex}`,
          token,
          index: rowIndex,
        });

        if (samples.length >= limit) {
          rl.close();
          break;
        }
      }
    } finally {
      rl.close();
      stream.close();
    }

    return samples;
  })();

  if (limit === DEFAULT_SAMPLE_LIMIT) {
    cachedSamplesPromise = loadPromise;
  }

  return loadPromise;
};
