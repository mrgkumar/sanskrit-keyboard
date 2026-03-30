import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { CORPUS_DATASETS } from './test-support/corpusRegistry';
import { resolvePredictionExperimentProfile } from './test-support/predictionExperimentProfiles';
import { evaluateLexicalPredictionsForDataset, summarizePrefixMetrics } from './test-support/predictionEvaluation';

test.describe('prediction experiment game', () => {
  test('completion-distance profile can beat baseline on a controlled fixture', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-game-'));

    try {
      const datasetPath = path.join(tempDir, 'dataset.ndjson');
      fs.writeFileSync(
        datasetPath,
        `${JSON.stringify({
          unique_identifier: 'row-1',
          'native word': 'अग्ने',
          'english word': 'agne',
          source: 'test',
        })}\n`,
        'utf8'
      );

      fs.mkdirSync(path.join(tempDir, 'runtime-lexicon-shards'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'runtime-lexicon-shards-manifest.json'),
        `${JSON.stringify(
          {
            version: 1,
            shards: [
              {
                prefix: 'ag',
                file: 'runtime-lexicon-shards/0061-0067.json',
                entryCount: 3,
                bytes: 1,
              },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'runtime-lexicon-shards/0061-0067.json'),
        `${JSON.stringify(
          {
            version: 1,
            prefix: 'ag',
            entries: [
              { itrans: 'agneya', devanagari: 'अग्नेय', count: 80 },
              { itrans: 'agni', devanagari: 'अग्नि', count: 40 },
              { itrans: 'agne', devanagari: 'अग्ने', count: 50 },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const originalDataset = CORPUS_DATASETS['san-valid'];
      CORPUS_DATASETS['san-valid'] = {
        ...originalDataset,
        path: datasetPath,
      };

      const baseline = await evaluateLexicalPredictionsForDataset({
        dataRoot: tempDir,
        datasetId: 'san-valid',
        profileId: 'baseline',
      });
      const experiment = await evaluateLexicalPredictionsForDataset({
        dataRoot: tempDir,
        datasetId: 'san-valid',
        profileId: 'r001-completion-distance-v1',
      });

      const baselineFinal = summarizePrefixMetrics(baseline.prefixMetrics.finalPrefix);
      const experimentFinal = summarizePrefixMetrics(experiment.prefixMetrics.finalPrefix);

      expect(resolvePredictionExperimentProfile('r001-completion-distance-v1').label).toContain('R-001');
      expect(baselineFinal.top1Hits).toBe(0);
      expect(experimentFinal.top1Hits).toBe(1);

      CORPUS_DATASETS['san-valid'] = originalDataset;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
