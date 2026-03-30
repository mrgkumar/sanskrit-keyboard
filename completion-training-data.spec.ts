import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  buildCompletionTrainingArtifactsFromCanonicalFile,
  buildCompletionPrefixExamples,
  buildCompletionTable,
} from './test-support/completionTrainingData';

test.describe('completion training data', () => {
  test('builds canonical completion entries and synthetic prefix examples', () => {
    const entries = buildCompletionTable({
      canonicalRecords: [
        { itrans: 'agni', devanagari: 'अग्नि', source: 'san-train' },
        { itrans: 'agni', devanagari: 'अग्नि', source: 'san-train' },
        { itrans: 'agni', devanagari: 'अग्निः', source: 'example-vedic' },
        { itrans: 'agne', devanagari: 'अग्ने', source: 'san-train' },
      ],
      swaraExactForms: new Map([
        [
          'agni',
          [
            {
              itrans: "a'gni",
              devanagari: 'अ॑ग्नि',
              count: 3,
            },
          ],
        ],
      ]),
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      canonicalItransWord: 'agni',
      sanskritWord: 'अग्नि',
      normalizedLookupKey: 'agni',
      frequency: 3,
      source: 'san-train',
      sourceWeightClass: 'core',
      hasSwara: true,
    });
    expect(entries[0].sources).toEqual([
      { source: 'san-train', count: 2 },
      { source: 'example-vedic', count: 1 },
    ]);
    expect(entries[0].swaraExactForms).toEqual([
      {
        itrans: "a'gni",
        devanagari: 'अ॑ग्नि',
        count: 3,
      },
    ]);

    const prefixes = buildCompletionPrefixExamples(entries);
    expect(prefixes.filter((entry) => entry.targetWord === 'agni')).toEqual([
      expect.objectContaining({ prefix: 'a', targetWord: 'agni', hasSwara: true }),
      expect.objectContaining({ prefix: 'ag', targetWord: 'agni', hasSwara: true }),
      expect.objectContaining({ prefix: 'agn', targetWord: 'agni', hasSwara: true }),
    ]);
  });

  test('streams completion artifacts from canonical ndjson without materializing all rows', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'completion-training-'));

    try {
      const canonicalPath = path.join(tempDir, 'canonical.ndjson');
      fs.writeFileSync(
        canonicalPath,
        [
          JSON.stringify({ itrans: 'agni', devanagari: 'अग्नि', source: 'san-train' }),
          JSON.stringify({ itrans: 'agni', devanagari: 'अग्निः', source: 'example-vedic' }),
          JSON.stringify({ itrans: 'agne', devanagari: 'अग्ने', source: 'san-train' }),
          '',
        ].join('\n'),
        'utf8'
      );

      const swaraPath = path.join(tempDir, 'swara-lexicon.json');
      fs.writeFileSync(
        swaraPath,
        `${JSON.stringify({
          version: 1,
          entries: [
            {
              normalized: 'agni',
              variants: [{ itrans: "a'gni", devanagari: 'अ॑ग्नि', count: 2 }],
            },
          ],
        })}\n`,
        'utf8'
      );

      const outputDir = path.join(tempDir, 'out');
      const summary = await buildCompletionTrainingArtifactsFromCanonicalFile({
        canonicalPath,
        swaraPath,
        outputDir,
        tempBucketDir: path.join(tempDir, 'buckets'),
        limit: null,
      });

      expect(summary).toMatchObject({
        processedRows: 3,
        entryCount: 2,
        prefixExampleCount: 6,
      });

      const completionTable = JSON.parse(fs.readFileSync(path.join(outputDir, 'completion-table.json'), 'utf8'));
      expect(completionTable.entryCount).toBe(2);
      expect(completionTable.entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            canonicalItransWord: 'agni',
            frequency: 2,
            hasSwara: true,
          }),
          expect.objectContaining({
            canonicalItransWord: 'agne',
            frequency: 1,
            hasSwara: false,
          }),
        ])
      );

      const prefixes = fs
        .readFileSync(path.join(outputDir, 'completion-prefixes.ndjson'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(prefixes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ prefix: 'a', targetWord: 'agni' }),
          expect.objectContaining({ prefix: 'agn', targetWord: 'agni' }),
          expect.objectContaining({ prefix: 'agn', targetWord: 'agne' }),
        ])
      );
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
