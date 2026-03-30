import fs from 'node:fs';
import path from 'node:path';

import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';
import {
  evaluateLexicalPredictionsForDataset,
  summarizeRetrieval,
} from '../test-support/predictionEvaluation.ts';
import { parseDatasetIds } from '../test-support/corpusRegistry.ts';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    datasets: ['san-valid', 'san-test'],
    dataRoot: getAutocompleteDataRoot(),
    output: path.resolve(process.cwd(), '..', 'generated', 'autocomplete', 'experiments', 'retrieval-leaderboard.json'),
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

const compareLeaderboard = (
  left: {
    retrieval: ReturnType<typeof summarizeRetrieval>;
    datasetId: string;
  },
  right: {
    retrieval: ReturnType<typeof summarizeRetrieval>;
    datasetId: string;
  }
) => {
  if (right.retrieval.coverageRate !== left.retrieval.coverageRate) {
    return right.retrieval.coverageRate - left.retrieval.coverageRate;
  }

  if (left.retrieval.finalPrefixRetrievalFailureRate !== right.retrieval.finalPrefixRetrievalFailureRate) {
    return left.retrieval.finalPrefixRetrievalFailureRate - right.retrieval.finalPrefixRetrievalFailureRate;
  }

  return left.datasetId.localeCompare(right.datasetId);
};

const main = async () => {
  const options = parseArgs();
  const startedAt = Date.now();
  const datasets = [];

  for (const datasetId of options.datasets) {
    const evaluation = await evaluateLexicalPredictionsForDataset({
      dataRoot: options.dataRoot,
      datasetId,
    });
    const retrieval = summarizeRetrieval(evaluation);
    datasets.push({
      datasetId: evaluation.datasetId,
      datasetLabel: evaluation.datasetLabel,
      rowCount: evaluation.rowCount,
      skippedRows: evaluation.skippedRows,
      retrieval,
      retrievalMisses: evaluation.sampleMisses.filter((sample) => sample.failureType === 'retrieval'),
    });
  }

  const leaderboard = [...datasets]
    .sort(compareLeaderboard)
    .map((dataset, index) => ({
      rank: index + 1,
      datasetId: dataset.datasetId,
      datasetLabel: dataset.datasetLabel,
      retrieval: dataset.retrieval,
      retrievalMisses: dataset.retrievalMisses,
    }));

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    dataRoot: options.dataRoot,
    datasets,
    leaderboard,
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
};

void main();
