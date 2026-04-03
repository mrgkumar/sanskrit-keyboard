import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

import { VIGNANAM_HARD_CORPUS } from './test-support/vignanamHardCorpus';

const normalizeFixtureText = (value: string) =>
  value
    .replace(/\u00A0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const VIGNANAM_CORPUS_PAGE_HASHES: Record<string, string> = {
  'sri-rudram-namakam': 'c63cd9c672ac4a17e98df37967041810636932c03f0fabd66092260c9ec2259e',
  'sri-rudram-chamakam': 'd9ff445552e4959be7f7b81e9140ff44f6ada21043bebc35115f0a91db782358',
  'purusha-suktam': 'cb02b0199766c8b19ebc298c90e5d6fde38483b74248c7445df2833bc53be734',
  'narayana-suktam': '75614feb1a345b8272d5105a8ee2cd5e2c4859baf5f640dd6166ae45008e53d0',
  'sri-suktam': 'e5f131e88d1b54cefd7119a5dab0bdac348c73c265fa01e5bcfd8faf4cd0f675',
};

const hashJson = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

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

test('Vignanam hard corpus is frozen as exact golden reference snapshots', () => {
  for (const page of VIGNANAM_HARD_CORPUS) {
    expect(hashJson(page), `${page.id} should keep its frozen corpus hash`).toBe(
      VIGNANAM_CORPUS_PAGE_HASHES[page.id],
    );

    for (const paragraph of page.paragraphs) {
      expect(paragraph.devanagari, `${page.id} paragraph ${paragraph.index} should remain frozen`).not.toBe('');
      expect(paragraph.tamil, `${page.id} paragraph ${paragraph.index} should remain frozen`).not.toBe('');
    }
  }
});
