import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { CORPUS_DATASETS } from './test-support/corpusRegistry';
import {
  evaluateLexicalPredictionsForDataset,
  summarizePrefixMetrics,
} from './test-support/predictionEvaluation';

test.describe('prediction evaluation helpers', () => {
  test('scores held-out prefixes against sharded runtime lexicon data', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-eval-'));

    try {
      const datasetPath = path.join(tempDir, 'dataset.ndjson');
      fs.writeFileSync(
        datasetPath,
        [
          JSON.stringify({
            unique_identifier: 'row-1',
            'native word': 'अग्नि',
            'english word': 'agni',
            source: 'test',
          }),
          JSON.stringify({
            unique_identifier: 'row-2',
            'native word': 'अग्ने',
            'english word': 'agne',
            source: 'test',
          }),
          '',
        ].join('\n'),
        'utf8'
      );

      const manifest = {
        version: 1,
        shards: [
          {
            prefix: 'ag',
            file: 'runtime-lexicon-shards/0061-0067.json',
            entryCount: 3,
            bytes: 1,
          },
        ],
      };
      fs.mkdirSync(path.join(tempDir, 'runtime-lexicon-shards'), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, 'runtime-lexicon-shards-manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'runtime-lexicon-shards/0061-0067.json'),
        `${JSON.stringify(
          {
            version: 1,
            prefix: 'ag',
            entries: [
              { itrans: 'agni', devanagari: 'अग्नि', count: 10 },
              { itrans: 'agne', devanagari: 'अग्ने', count: 7 },
              { itrans: 'agra', devanagari: 'अग्र', count: 8 },
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

      const result = await evaluateLexicalPredictionsForDataset({
        dataRoot: tempDir,
        datasetId: 'san-valid',
      });

      expect(result.datasetId).toBe('san-valid');
      expect(result.eligibleWords).toBe(2);
      expect(result.inLexiconWords).toBe(2);
      expect(result.missingWords).toBe(0);

      const finalSummary = summarizePrefixMetrics(result.prefixMetrics.finalPrefix);
      expect(finalSummary.queries).toBe(2);
      expect(finalSummary.top1Hits).toBe(1);
      expect(finalSummary.top3Hits).toBe(2);
      expect(finalSummary.top5Hits).toBe(2);
      expect(result.sampleMisses).toEqual([]);

      CORPUS_DATASETS['san-valid'] = originalDataset;
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
