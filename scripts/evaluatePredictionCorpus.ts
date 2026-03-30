import fs from 'node:fs';
import path from 'node:path';

import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';
import {
  evaluateLexicalPredictionsForDataset,
  summarizeFailureBreakdown,
  summarizePrefixMetrics,
} from '../test-support/predictionEvaluation.ts';
import { parseDatasetIds } from '../test-support/corpusRegistry.ts';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    datasets: ['san-valid', 'san-test'],
    dataRoot: getAutocompleteDataRoot(),
    output: null as string | null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--datasets' && next) {
      options.datasets = parseDatasetIds(next);
      index += 1;
      continue;
    }

    if (arg === '--data-root' && next) {
      options.dataRoot = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--output' && next) {
      options.output = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  const startedAt = new Date();
  const datasets = [];

  for (const datasetId of options.datasets) {
    const result = await evaluateLexicalPredictionsForDataset({
      dataRoot: options.dataRoot,
      datasetId,
    });
    datasets.push({
      ...result,
      prefixMetrics: {
        finalPrefix: summarizePrefixMetrics(result.prefixMetrics.finalPrefix),
        allPrefixes: summarizePrefixMetrics(result.prefixMetrics.allPrefixes),
      },
      failureBreakdown: {
        finalPrefix: summarizeFailureBreakdown(result.failureBreakdown.finalPrefix),
        allPrefixes: summarizeFailureBreakdown(result.failureBreakdown.allPrefixes),
      },
    });
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    dataRoot: options.dataRoot,
    datasets,
  };

  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  console.log(JSON.stringify(payload, null, 2));
};

void main();
