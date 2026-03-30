import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { CORPUS_DATASETS } from './test-support/corpusRegistry';
import { resolvePredictionExperimentProfile } from './test-support/predictionExperimentProfiles';
import {
  evaluateLexicalPredictionsForDataset,
  shouldApplyCompletionDistancePenalty,
  summarizePrefixMetrics,
} from './test-support/predictionEvaluation';

const writeFixture = ({
  tempDir,
  nativeWord,
  entries,
}: {
  tempDir: string;
  nativeWord: string;
  entries: Array<{ itrans: string; devanagari: string; count: number }>;
}) => {
  const datasetPath = path.join(tempDir, 'dataset.ndjson');
  fs.writeFileSync(
    datasetPath,
    `${JSON.stringify({
      unique_identifier: 'row-1',
      'native word': nativeWord,
      'english word': '',
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
            entryCount: entries.length,
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
        entries,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  return datasetPath;
};

const withDatasetOverride = async (datasetPath: string, fn: () => Promise<void>) => {
  const originalDataset = CORPUS_DATASETS['san-valid'];
  CORPUS_DATASETS['san-valid'] = {
    ...originalDataset,
    path: datasetPath,
  };

  try {
    await fn();
  } finally {
    CORPUS_DATASETS['san-valid'] = originalDataset;
  }
};

test.describe('prediction experiment game', () => {
  test('v1 activates earlier than v2 and v3 on shorter late-prefix fixtures', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-game-v1-'));

    try {
      const datasetPath = writeFixture({
        tempDir,
        nativeWord: 'अग्नेय',
        entries: [
          { itrans: 'agneyam', devanagari: 'अग्नेयम्', count: 70 },
          { itrans: 'agneyaH', devanagari: 'अग्नेयः', count: 65 },
          { itrans: 'agneya', devanagari: 'अग्नेय', count: 50 },
        ],
      });

      await withDatasetOverride(datasetPath, async () => {
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
        const experimentV3 = await evaluateLexicalPredictionsForDataset({
          dataRoot: tempDir,
          datasetId: 'san-valid',
          profileId: 'r001-completion-distance-v3',
        });

        const baselineFinal = summarizePrefixMetrics(baseline.prefixMetrics.finalPrefix);
        const experimentV1Final = summarizePrefixMetrics(experimentV1.prefixMetrics.finalPrefix);
        const experimentV2Final = summarizePrefixMetrics(experimentV2.prefixMetrics.finalPrefix);
        const experimentV3Final = summarizePrefixMetrics(experimentV3.prefixMetrics.finalPrefix);

        expect(resolvePredictionExperimentProfile('r001-completion-distance-v1').label).toContain('R-001');
        expect(resolvePredictionExperimentProfile('r001-completion-distance-v2').label).toContain('R-001');
        expect(resolvePredictionExperimentProfile('r001-completion-distance-v3').label).toContain('R-001');
        expect(baselineFinal.top1Hits).toBe(0);
        expect(experimentV1Final.top1Hits).toBe(1);
        expect(experimentV2Final.top1Hits).toBe(0);
        expect(experimentV3Final.top1Hits).toBe(0);
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('v3 requires stronger candidate coverage than v2 before activating the penalty', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-game-v3-'));

    try {
      const datasetPath = writeFixture({
        tempDir,
        nativeWord: 'अग्नेयम्',
        entries: [
          { itrans: 'agneyasya', devanagari: 'अग्नेयस्य', count: 70 },
          { itrans: 'agneyam', devanagari: 'अग्नेयम्', count: 50 },
        ],
      });

      await withDatasetOverride(datasetPath, async () => {
        const baseline = await evaluateLexicalPredictionsForDataset({
          dataRoot: tempDir,
          datasetId: 'san-valid',
          profileId: 'baseline',
        });
        const experimentV2 = await evaluateLexicalPredictionsForDataset({
          dataRoot: tempDir,
          datasetId: 'san-valid',
          profileId: 'r001-completion-distance-v2',
        });
        const experimentV3 = await evaluateLexicalPredictionsForDataset({
          dataRoot: tempDir,
          datasetId: 'san-valid',
          profileId: 'r001-completion-distance-v3',
        });

        const baselineFinal = summarizePrefixMetrics(baseline.prefixMetrics.finalPrefix);
        const experimentV2Final = summarizePrefixMetrics(experimentV2.prefixMetrics.finalPrefix);
        const experimentV3Final = summarizePrefixMetrics(experimentV3.prefixMetrics.finalPrefix);

        expect(baselineFinal.top1Hits).toBe(0);
        expect(experimentV2Final.top1Hits).toBe(1);
        expect(experimentV3Final.top1Hits).toBe(0);
      });
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('v4 and v5 wait until the candidate is near completion before applying the penalty', async () => {
    const candidate = { itrans: 'agneyastvasya', devanagari: 'अग्नेयस्त्वस्य', count: 10 };
    const prefix = 'agneya';

    expect(resolvePredictionExperimentProfile('r001-completion-distance-v4').label).toContain('R-001');
    expect(resolvePredictionExperimentProfile('r001-completion-distance-v5').label).toContain('R-001');
    expect(
      shouldApplyCompletionDistancePenalty(
        candidate,
        prefix,
        resolvePredictionExperimentProfile('r001-completion-distance-v1')
      )
    ).toBe(true);
    expect(
      shouldApplyCompletionDistancePenalty(
        candidate,
        prefix,
        resolvePredictionExperimentProfile('r001-completion-distance-v4')
      )
    ).toBe(false);
    expect(
      shouldApplyCompletionDistancePenalty(
        candidate,
        prefix,
        resolvePredictionExperimentProfile('r001-completion-distance-v5')
      )
    ).toBe(false);
  });
});
