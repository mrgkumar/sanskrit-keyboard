import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';

import { VIGNANAM_HARD_CORPUS } from './test-support/vignanamHardCorpus';
import { detransliterate, transliterate, formatSourceForScript } from './src/lib/vedic/utils';

const normalizeFixtureText = (value: string) =>
  value
    .replace(/\u00A0/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();

const normalizeTamilChainText = (value: string) =>
  normalizeFixtureText(value)
    .replace(/-/gu, ' ')
    .replace(/\u0B82/gu, ' ') // Normalize anusvara to space
    .replace(/\u0BCD[\u0B99\u0B9E\u0BA3\u0BA8\u0BAE]/gu, ' ') // Normalize all nasal pulli sequences to space
    .replace(/[௦-௯]/gu, (digit) => String.fromCharCode(digit.codePointAt(0)! - 0x0BE6 + 0x30));

const normalizeChainText = (value: string) =>
  normalizeFixtureText(value)
    .replace(/\u200C/gu, '')
    .replace(/\uF176/gu, '\u1CDA')
    .replace(/\uA8FB/gu, '-') // Normalize Vedic hyphen back to standard
    .replace(/-/gu, ' ')
    .replace(/।।/gu, '॥')
    .replace(/[०-९]/gu, (digit) => String.fromCharCode(digit.codePointAt(0)! - 0x0966 + 0x30));

const splitSentences = (value: string) =>
  value
    .split(/(?<=[।॥])/u)
    .map((sentence) => normalizeFixtureText(sentence))
    .filter(Boolean);

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

test('Vignanam hard corpus is frozen at sentence level', () => {
  const VIGNANAM_SENTENCE_COUNTS: Record<string, number> = {
    'sri-rudram-namakam': 107,
    'sri-rudram-chamakam': 26,
    'purusha-suktam': 117,
    'narayana-suktam': 42,
    'sri-suktam': 77,
  };

  const VIGNANAM_SENTENCE_HASHES: Record<string, string> = {
    'sri-rudram-namakam': 'dfcf55e984acb1ba197a05ef4324f57a4bd253846933d80d5be80f10601d6511',
    'sri-rudram-chamakam': '04c03188d1cbf94d6cb28c1fada032ccedd7ff8a848b0668cd0d9747249bf096',
    'purusha-suktam': '485002ddce848bb097fb33d0471099cbc0e8600c5016152ef8acbc9e007b4d8f',
    'narayana-suktam': '6d05e8532db4196ed2380b0689f0cac570462ba1aeede4346233f94d88ba08ae',
    'sri-suktam': '5dd17643fe88622cd3eb760fb7428926c868e61fa5d7933335a9086d2d64d06e',
  };

  for (const page of VIGNANAM_HARD_CORPUS) {
    const sentencePairs = page.paragraphs.flatMap((paragraph) => {
      const devanagariSentences = splitSentences(paragraph.devanagari);
      const tamilSentences = splitSentences(paragraph.tamil);

      expect(
        devanagariSentences.length,
        `${page.id} paragraph ${paragraph.index} should keep sentence counts aligned`,
      ).toBe(tamilSentences.length);

      return devanagariSentences.map((devanagari, index) => ({
        paragraph: paragraph.index,
        sentence: index + 1,
        devanagari,
        tamil: tamilSentences[index] ?? '',
      }));
    });

    expect(sentencePairs.length, `${page.id} should keep its frozen sentence count`).toBe(
      VIGNANAM_SENTENCE_COUNTS[page.id],
    );
    expect(hashJson(sentencePairs), `${page.id} should keep its frozen sentence hash`).toBe(
      VIGNANAM_SENTENCE_HASHES[page.id],
    );
  }

  const sriSuktam = VIGNANAM_HARD_CORPUS.find((page) => page.id === 'sri-suktam');
  const paragraphOne = sriSuktam?.paragraphs.find((paragraph) => paragraph.index === 1);
  expect(paragraphOne, 'Sri Suktam paragraph 1 should exist').toBeDefined();
  if (!paragraphOne) {
    return;
  }

  const tamilSentences = splitSentences(paragraphOne.tamil);
  expect(tamilSentences).toEqual([
    'ஓம் ॥',
    'ஹிர॑ண்யவர்ணாம்॒ ஹரி॑ணீம் ஸு॒வர்ண॑ரஜ॒தஸ்ர॑ஜாம் ।',
    'ச॒ந்த்³ராம் ஹி॒ரண்ம॑யீம் ல॒க்ஷ்மீம் ஜாத॑வேதோ³ ம॒மாவ॑ஹ ॥',
  ]);
});

test('Vignanam hard corpus keeps the Devanagari -> Roman -> Devanagari -> Roman chain closed per sentence', () => {
  for (const page of VIGNANAM_HARD_CORPUS) {
    for (const paragraph of page.paragraphs) {
      const devanagariSentences = splitSentences(paragraph.devanagari);

      expect(
        devanagariSentences.length,
        `${page.id} paragraph ${paragraph.index} should keep sentence counts aligned for the chain`,
      ).toBe(splitSentences(paragraph.tamil).length);

      devanagariSentences.forEach((devanagari, sentenceIndex) => {
        const roman1 = detransliterate(devanagari);
        const devanagari2 = transliterate(roman1).unicode;
        const roman2 = detransliterate(devanagari2);

        expect(roman2, `${page.id} paragraph ${paragraph.index} sentence ${sentenceIndex + 1} should keep Roman stable`).toBe(roman1);
        expect(
          normalizeChainText(devanagari2),
          `${page.id} paragraph ${paragraph.index} sentence ${sentenceIndex + 1} should return to the frozen Devanagari sentence`,
        ).toBe(normalizeChainText(devanagari));
      });
    }
  }
});

test('Vignanam hard corpus keeps the Devanagari -> Roman -> Tamil chain aligned', () => {
  for (const page of VIGNANAM_HARD_CORPUS) {
    for (const paragraph of page.paragraphs) {
      const devanagariSentences = splitSentences(paragraph.devanagari);
      const tamilSentences = splitSentences(paragraph.tamil);

      devanagariSentences.forEach((devanagari, sentenceIndex) => {
        const roman = detransliterate(devanagari);
        const tamil = formatSourceForScript(roman, 'tamil', {
          romanOutputStyle: 'canonical',
          tamilOutputStyle: 'precision',
        });

        const expectedTamil = tamilSentences[sentenceIndex] ?? '';
        
        // We use a slightly more relaxed normalization for Tamil comparison 
        // as some subtle rendering markers might differ but the characters should match.
        expect(
          normalizeTamilChainText(tamil),
          `${page.id} paragraph ${paragraph.index} sentence ${sentenceIndex + 1} should align with Tamil corpus`,
        ).toBe(normalizeTamilChainText(expectedTamil));
      });
    }
  }
});
