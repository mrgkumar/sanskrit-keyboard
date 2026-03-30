import fs from 'node:fs';
import path from 'node:path';

import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';
import { parseDatasetIds } from '../test-support/corpusRegistry.ts';
import {
  PREDICTION_EXPERIMENT_PROFILES,
  resolvePredictionExperimentProfile,
} from '../test-support/predictionExperimentProfiles.ts';
import {
  evaluateLexicalPredictionsForDataset,
  summarizePrefixMetrics,
  type DatasetEvaluationResult,
} from '../test-support/predictionEvaluation.ts';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    profiles: Object.keys(PREDICTION_EXPERIMENT_PROFILES),
    tuningDataset: 'san-valid',
    holdoutDataset: 'san-test',
    dataRoot: getAutocompleteDataRoot(),
    output: path.resolve(process.cwd(), '..', 'generated', 'autocomplete', 'experiments', 'leaderboard.json'),
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--profiles' && next) {
      options.profiles = parseDatasetIds(next);
      index += 1;
      continue;
    }

    if (arg === '--tuning-dataset' && next) {
      options.tuningDataset = next;
      index += 1;
      continue;
    }

    if (arg === '--holdout-dataset' && next) {
      options.holdoutDataset = next;
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

const compareResults = (left: DatasetEvaluationResult, right: DatasetEvaluationResult) => {
  const leftFinal = summarizePrefixMetrics(left.prefixMetrics.finalPrefix);
  const rightFinal = summarizePrefixMetrics(right.prefixMetrics.finalPrefix);

  if (rightFinal.top5Rate !== leftFinal.top5Rate) {
    return rightFinal.top5Rate - leftFinal.top5Rate;
  }

  if (rightFinal.top3Rate !== leftFinal.top3Rate) {
    return rightFinal.top3Rate - leftFinal.top3Rate;
  }

  if (rightFinal.top1Rate !== leftFinal.top1Rate) {
    return rightFinal.top1Rate - leftFinal.top1Rate;
  }

  return left.profileId.localeCompare(right.profileId);
};

const main = async () => {
  const options = parseArgs();
  const startedAt = Date.now();
  const tuningResults: DatasetEvaluationResult[] = [];

  for (const profileId of options.profiles) {
    resolvePredictionExperimentProfile(profileId);
    tuningResults.push(
      await evaluateLexicalPredictionsForDataset({
        dataRoot: options.dataRoot,
        datasetId: options.tuningDataset,
        profileId,
      })
    );
  }

  tuningResults.sort(compareResults);
  const winner = tuningResults[0];
  const holdoutResult = await evaluateLexicalPredictionsForDataset({
    dataRoot: options.dataRoot,
    datasetId: options.holdoutDataset,
    profileId: winner.profileId,
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    tuningDataset: options.tuningDataset,
    holdoutDataset: options.holdoutDataset,
    winner: {
      profileId: winner.profileId,
      label: resolvePredictionExperimentProfile(winner.profileId).label,
    },
    leaderboard: tuningResults.map((result, index) => ({
      rank: index + 1,
      profileId: result.profileId,
      label: resolvePredictionExperimentProfile(result.profileId).label,
      finalPrefix: summarizePrefixMetrics(result.prefixMetrics.finalPrefix),
      allPrefixes: summarizePrefixMetrics(result.prefixMetrics.allPrefixes),
      missingWords: result.missingWords,
      sampleMisses: result.sampleMisses,
    })),
    holdoutCheck: {
      profileId: holdoutResult.profileId,
      label: resolvePredictionExperimentProfile(holdoutResult.profileId).label,
      finalPrefix: summarizePrefixMetrics(holdoutResult.prefixMetrics.finalPrefix),
      allPrefixes: summarizePrefixMetrics(holdoutResult.prefixMetrics.allPrefixes),
      missingWords: holdoutResult.missingWords,
      sampleMisses: holdoutResult.sampleMisses,
    },
  };

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(payload, null, 2));
};

void main();
