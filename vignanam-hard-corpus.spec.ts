import { expect, test } from '@playwright/test';

import { formatSourceForOutput, detransliterate } from '@/lib/vedic/utils';
import { VIGNANAM_HARD_CORPUS } from './test-support/vignanamHardCorpus';
import { getVignanamAlignmentScore } from './test-support/vignanamAlignment';

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

test('Vignanam hard corpus aligns on normalized Roman keys without pretending to be exact Tamil precision', () => {
  for (const page of VIGNANAM_HARD_CORPUS) {
    let totalScore = 0;
    let minimumScore = 1;
    const sampleIndexes = [0, Math.floor(page.paragraphs.length / 2), page.paragraphs.length - 1]
      .filter((index, position, array) => array.indexOf(index) === position && index >= 0);

    for (const paragraph of page.paragraphs) {
      const canonicalRoman = detransliterate(paragraph.devanagari);
      const alignment = getVignanamAlignmentScore(canonicalRoman, paragraph.tamil);

      expect(canonicalRoman, `${page.id} paragraph ${paragraph.index} should produce canonical Roman`).not.toBe('');
      expect(
        formatSourceForOutput(canonicalRoman, { outputScheme: 'sanskrit-tamil-precision' }),
        `${page.id} paragraph ${paragraph.index} should still produce Tamil precision output`,
      ).not.toBe('');

      totalScore += alignment.score;
      minimumScore = Math.min(minimumScore, alignment.score);

      if (sampleIndexes.includes(paragraph.index - 1)) {
        expect(alignment.score, `${page.id} paragraph ${paragraph.index} should stay alignment-friendly`).toBeGreaterThanOrEqual(0.78);
      }
    }

    const averageScore = totalScore / page.paragraphs.length;
    expect(averageScore, `${page.id} should stay alignable after normalization`).toBeGreaterThanOrEqual(0.85);
    expect(minimumScore, `${page.id} should not fall out of alignment on any paragraph`).toBeGreaterThanOrEqual(0.76);
  }
});
