import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { CORPUS_DATASETS } from './test-support/corpusRegistry';
import {
  analyzePreparedRetrievalGaps,
  DiskRuntimeLexicon,
  evaluateLexicalPredictionsForDataset,
  prepareDatasetEvaluationInput,
  summarizeRetrieval,
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
      try {
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
        expect(result.failureBreakdown.finalPrefix).toEqual({
          queries: 2,
          retrievalFailures: 0,
          rankingFailures: 0,
        });

        const finalSummary = summarizePrefixMetrics(result.prefixMetrics.finalPrefix);
        expect(finalSummary.queries).toBe(2);
        expect(finalSummary.top1Hits).toBe(1);
        expect(finalSummary.top3Hits).toBe(2);
        expect(finalSummary.top5Hits).toBe(2);
        expect(result.sampleMisses).toEqual([]);
      } finally {
        CORPUS_DATASETS['san-valid'] = originalDataset;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('separates retrieval failures from ranking failures', async () => {
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
            'native word': 'अग्रे',
            'english word': 'agre',
            source: 'test',
          }),
          '',
        ].join('\n'),
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
                entryCount: 5,
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
              { itrans: 'agna', devanagari: 'अग्न', count: 100 },
              { itrans: 'agraa', devanagari: 'अग्रा', count: 99 },
              { itrans: 'agra', devanagari: 'अग्र', count: 98 },
              { itrans: 'agraha', devanagari: 'अग्रह', count: 97 },
              { itrans: 'agrima', devanagari: 'अग्रिम', count: 96 },
              { itrans: 'agrayaNa', devanagari: 'अग्रयण', count: 95 },
              { itrans: 'agre', devanagari: 'अग्रे', count: 94 },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const originalDataset = CORPUS_DATASETS['san-valid'];
      try {
        CORPUS_DATASETS['san-valid'] = {
          ...originalDataset,
          path: datasetPath,
        };

        const result = await evaluateLexicalPredictionsForDataset({
          dataRoot: tempDir,
          datasetId: 'san-valid',
        });

        expect(result.inLexiconWords).toBe(1);
        expect(result.missingWords).toBe(1);
        expect(result.failureBreakdown.finalPrefix).toEqual({
          queries: 2,
          retrievalFailures: 1,
          rankingFailures: 1,
        });
        expect(result.sampleMisses).toEqual(expect.arrayContaining([
          expect.objectContaining({
            target: 'agni',
            failureType: 'retrieval',
          }),
          expect.objectContaining({
            target: 'agre',
            failureType: 'ranking',
          }),
        ]));
      } finally {
        CORPUS_DATASETS['san-valid'] = originalDataset;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('summarizes retrieval coverage independently from ranking failures', () => {
    const retrieval = summarizeRetrieval({
      profileId: 'baseline',
      datasetId: 'san-valid',
      datasetLabel: 'Validation',
      rowCount: 3,
      skippedRows: 0,
      eligibleWords: 3,
      inLexiconWords: 2,
      missingWords: 1,
      prefixMetrics: {
        finalPrefix: {
          queries: 3,
          top1Hits: 1,
          top3Hits: 2,
          top5Hits: 2,
        },
        allPrefixes: {
          queries: 6,
          top1Hits: 2,
          top3Hits: 3,
          top5Hits: 4,
        },
      },
      failureBreakdown: {
        finalPrefix: {
          queries: 3,
          retrievalFailures: 1,
          rankingFailures: 1,
        },
        allPrefixes: {
          queries: 6,
          retrievalFailures: 2,
          rankingFailures: 1,
        },
      },
      sampleMisses: [],
    });

    expect(retrieval).toEqual({
      eligibleWords: 3,
      inLexiconWords: 2,
      missingWords: 1,
      coverageRate: 2 / 3,
      finalPrefixQueries: 3,
      finalPrefixRetrievalFailures: 1,
      finalPrefixRetrievalFailureRate: 1 / 3,
      allPrefixQueries: 6,
      allPrefixRetrievalFailures: 2,
      allPrefixRetrievalFailureRate: 2 / 6,
    });
  });

  test('classifies missing words by deepest prefix with surviving suggestions', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prediction-gap-'));

    try {
      const datasetPath = path.join(tempDir, 'dataset.ndjson');
      fs.writeFileSync(
        datasetPath,
        [
          JSON.stringify({
            unique_identifier: 'row-1',
            'native word': 'अग्नी',
            'english word': 'agnii',
            source: 'test',
          }),
          JSON.stringify({
            unique_identifier: 'row-2',
            'native word': 'अक्ष',
            'english word': 'akSa',
            source: 'test',
          }),
          '',
        ].join('\n'),
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
                entryCount: 2,
                bytes: 1,
              },
              {
                prefix: 'ak',
                file: 'runtime-lexicon-shards/0061-006b.json',
                entryCount: 0,
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
              { itrans: 'agni', devanagari: 'अग्नि', count: 10 },
              { itrans: 'agne', devanagari: 'अग्ने', count: 9 },
            ],
          },
          null,
          2
        )}\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(tempDir, 'runtime-lexicon-shards/0061-006b.json'),
        `${JSON.stringify(
          {
            version: 1,
            prefix: 'ak',
            entries: [],
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      const originalDataset = CORPUS_DATASETS['san-valid'];
      try {
        CORPUS_DATASETS['san-valid'] = {
          ...originalDataset,
          path: datasetPath,
        };

        const prepared = await prepareDatasetEvaluationInput({ datasetId: 'san-valid' });
        const analysis = analyzePreparedRetrievalGaps({
          prepared,
          lexicon: new DiskRuntimeLexicon(tempDir),
        });

        expect(analysis.missingWords).toBe(2);
        expect(analysis.missingWithAnyPrefixSuggestions).toBe(1);
        expect(analysis.missingWithFinalPrefixSuggestions).toBe(1);
        expect(analysis.deepestSuggestedPrefixHistogram).toEqual({
          '4': 1,
          none: 1,
        });
        expect(analysis.sampleMissingFamilies).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: 'agnii',
              deepestSuggestedPrefix: 'agni',
              finalPrefix: 'agni',
              finalPrefixSuggestions: ['agni'],
            }),
            expect.objectContaining({
              target: 'akSha',
              deepestSuggestedPrefix: null,
            }),
          ])
        );
      } finally {
        CORPUS_DATASETS['san-valid'] = originalDataset;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
