import { expect, test } from '@playwright/test';

import { formatSourceForOutput, detransliterate, reverseTamilInput } from '@/lib/vedic/utils';
import { VIGNANAM_HARD_CORPUS } from './test-support/vignanamHardCorpus';

const normalizeFixtureText = (value: string) =>
  value
    .replace(/\u00A0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

test('Vignanam hard corpus freezes the aligned page snapshots and paragraph counts', () => {
  expect(VIGNANAM_HARD_CORPUS.map((page) => page.id)).toEqual([
    'sri-rudram-namakam',
    'sri-rudram-chamakam',
    'purusha-suktam',
    'narayana-suktam',
    'sri-suktam',
  ]);

  expect(VIGNANAM_HARD_CORPUS.map((page) => page.paragraphCount)).toEqual([44, 13, 26, 18, 36]);

  for (const page of VIGNANAM_HARD_CORPUS) {
    expect(page.devanagariUrl).toContain(page.id);
    expect(page.tamilUrl).toContain(page.id);
    expect(page.paragraphs.length).toBe(page.paragraphCount);
    for (const paragraph of page.paragraphs) {
      expect(normalizeFixtureText(paragraph.devanagari), `${page.id} paragraph ${paragraph.index} should stay non-empty`).not.toBe('');
      expect(normalizeFixtureText(paragraph.tamil), `${page.id} paragraph ${paragraph.index} should stay non-empty`).not.toBe('');
    }
  }
});

test('Vignanam hard corpus can be consumed by the canonical and Tamil precision pipelines without crashing', () => {
  for (const page of VIGNANAM_HARD_CORPUS) {
    const sampleIndexes = [0, Math.floor(page.paragraphs.length / 2), page.paragraphs.length - 1]
      .filter((index, position, array) => array.indexOf(index) === position && index >= 0);

    for (const index of sampleIndexes) {
      const paragraph = page.paragraphs[index];
      const canonicalRoman = detransliterate(paragraph.devanagari);
      const reverseResult = reverseTamilInput(paragraph.tamil, {
        inputMode: 'tamil-precision',
        outputMode: 'canonical',
      });

      expect(canonicalRoman, `${page.id} paragraph ${paragraph.index} should produce canonical Roman`).not.toBe('');
      expect(
        formatSourceForOutput(canonicalRoman, { outputScheme: 'sanskrit-tamil-precision' }),
        `${page.id} paragraph ${paragraph.index} should produce Tamil precision output`,
      ).not.toBe('');
      expect(reverseResult.status, `${page.id} paragraph ${paragraph.index} should not look like precision reverse goldens`).toBe('rejected');
      if (reverseResult.status === 'rejected') {
        expect(reverseResult.originalText).toBe(paragraph.tamil);
      }
    }
  }
});
