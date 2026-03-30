import fs from 'node:fs';
import path from 'node:path';

import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';
import { parseDatasetIds } from '../test-support/corpusRegistry.ts';
import {
  analyzePreparedRetrievalGaps,
  DiskRuntimeLexicon,
  prepareDatasetEvaluationInputCached,
} from '../test-support/predictionEvaluation.ts';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    datasets: ['san-valid', 'san-test'],
    dataRoot: getAutocompleteDataRoot(),
    output: path.resolve(process.cwd(), '..', 'generated', 'autocomplete', 'experiments', 'retrieval-gap-audit.json'),
    cacheDir: path.resolve(process.cwd(), '..', 'generated', 'autocomplete', 'experiments', 'cache'),
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
      continue;
    }

    if (arg === '--cache-dir' && next) {
      options.cacheDir = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  const startedAt = Date.now();
  const lexicon = new DiskRuntimeLexicon(options.dataRoot);
  const datasets = [];

  for (const datasetId of options.datasets) {
    const prepared = await prepareDatasetEvaluationInputCached({
      datasetId,
      cacheDir: options.cacheDir,
    });
    datasets.push(
      analyzePreparedRetrievalGaps({
        prepared,
        lexicon,
      })
    );
  }

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    dataRoot: options.dataRoot,
    datasets,
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
};

void main();
