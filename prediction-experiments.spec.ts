import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { CORPUS_DATASETS } from './test-support/corpusRegistry';
import { resolvePredictionExperimentProfile } from './test-support/predictionExperimentProfiles';
import { evaluateLexicalPredictionsForDataset, summarizePrefixMetrics } from './test-support/predictionEvaluation';

test.describe('prediction experiment game', () => {
  test('completion-distance profiles improve late-prefix ranking without changing early-prefix baseline behavior', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-game-'));

    try {
      const datasetPath = path.join(tempDir, 'dataset.ndjson');
      fs.writeFileSync(
        datasetPath,
        `${JSON.stringify({
          unique_identifier: 'row-1',
          'native word': 'अग्नेय',
          'english word': 'agneya',
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
              { itrans: 'agneyam', devanagari: 'अग्नेयम्', count: 70 },
              { itrans: 'agneyaH', devanagari: 'अग्नेयः', count: 65 },
              { itrans: 'agneya', devanagari: 'अग्नेय', count: 50 },
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
      const experimentV1 = await evaluateLexicalPredictionsForDataset({
        dataRoot: tempDir,
        datasetId: 'san-valid',
        profileId: 'r001-completion-distance-v1',
      });
      const experimentV2 = await evaluateLexicalPredictionsForDataset({
        dataRoot: tempDir,
        datasetId: 'san-valid',
        profileId: 'r001-completion-distance-v2',
      });

      const baselineFinal = summarizePrefixMetrics(baseline.prefixMetrics.finalPrefix);
      const experimentV1Final = summarizePrefixMetrics(experimentV1.prefixMetrics.finalPrefix);
      const experimentV2Final = summarizePrefixMetrics(experimentV2.prefixMetrics.finalPrefix);
      const baselineAll = summarizePrefixMetrics(baseline.prefixMetrics.allPrefixes);
      const experimentV2All = summarizePrefixMetrics(experimentV2.prefixMetrics.allPrefixes);

      expect(resolvePredictionExperimentProfile('r001-completion-distance-v1').label).toContain('R-001');
      expect(resolvePredictionExperimentProfile('r001-completion-distance-v2').label).toContain('R-001');
      expect(baselineFinal.top1Hits).toBe(0);
      expect(experimentV1Final.top1Hits).toBe(1);
      expect(experimentV2Final.top1Hits).toBe(0);
      expect(experimentV2All.top1Hits).toBeGreaterThanOrEqual(baselineAll.top1Hits);

      CORPUS_DATASETS['san-valid'] = originalDataset;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
