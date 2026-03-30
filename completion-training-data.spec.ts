import { expect, test } from '@playwright/test';

import {
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
});
