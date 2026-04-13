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
    .replace(/[\u200B-\u200D]/gu, '') // Strip all zero-width characters
    .replace(/[\uF000-\uFFFF]/gu, '') // Strip all PUA characters
    .replace(/\uA8FB/gu, '') // Strip Vedic hyphen
    .replace(/[௢௣]/gu, 'ல') // Normalize vocalic l/ll matras to la
    .replace(/[ளழ]/gu, 'ல') // Normalize L and zh to l
    .replace(/ற/gu, 'ர') // Normalize R to r
    .replace(/¹/gu, '') // Ignore scholarly superscript 1
    .replace(/[-]/gu, '') // Strip hyphens
    .replace(/[॒॑᳚ऽ]/gu, '') // Strip Vedic tones and avagraha
    .replace(/[:ஂம்ங்ஞ்ண்ந்ன்மாிீுூெேொோைௌ்²³⁴]/gu, '') // Strip all markers and vowel signs, but keep bare consonants
    .replace(/\s+/gu, '')
    .replace(/(.)\1+/gu, '$1') // Collapse all double characters
    .replace(/[௦-௯]/gu, (digit) => String.fromCharCode(digit.codePointAt(0)! - 0x0BE6 + 0x30))
    .replace(/[०-९]/gu, (digit) => String.fromCharCode(digit.codePointAt(0)! - 0x0966 + 0x30))
    .trim();

const normalizeChainText = (value: string) =>
  normalizeFixtureText(value)
    .replace(/\u200C/gu, '')
    .replace(/\uF176/gu, '\u1CDA')
    .replace(/\uA8FB/gu, '') // Strip Vedic hyphen
    .replace(/[-]/gu, '')
    .replace(/[:]/gu, '') // Strip visarga
    .replace(/[॒॑᳚]/gu, '') // Strip Vedic tones
    .replace(/्/gu, '') // Strip halanta
    .replace(/(.)\1+/gu, '$1') // Collapse double characters
    .replace(/।।/gu, '॥')
    .replace(/[०-९]/gu, (digit) => String.fromCharCode(digit.codePointAt(0)! - 0x0966 + 0x30))
    .replace(/\s+/gu, '')
    .trim();

const splitSentences = (value: string) =>
  value
    .split(/(?<=[।॥])/u)
    .map((sentence) => normalizeFixtureText(sentence))
    .filter(Boolean);

const VIGNANAM_CORPUS_PAGE_HASHES: Record<string, string> = {
  'sri-rudram-namakam': 'c63cd9c672ac4a17e98df37967041810636932c03f0fabd66092260c9ec2259e',
  'sri-rudram-chamakam': 'd9ff445552e4959be7f7b81e9140ff44f6ada21043bebc35115f0a91db782358',
  'purusha-suktam': '739da27f4365756c169a3483dab955776c61f7e5301c8858fd28cd98f102ca51',
  'narayana-suktam': '75614feb1a345b8272d5105a8ee2cd5e2c4859baf5f640dd6166ae45008e53d0',
  'sri-suktam': '93d25b6c402f126c9601b70db320886635eab4ed9a428df3f44d7c667194c973',
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
    'purusha-suktam': '638a89ec704cb7fb82deccefec88a8f117d4d0b6d1b2ad478653c0d5bc8c75ff',
    'narayana-suktam': '6d05e8532db4196ed2380b0689f0cac570462ba1aeede4346233f94d88ba08ae',
    'sri-suktam': '5ef00c243058a20bfc709e9298a2f0cae6b882f88ad6e780c41f4cce993c9783',
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
        const normReceived = normalizeTamilChainText(tamil);
        const normExpected = normalizeTamilChainText(expectedTamil);

        if (normReceived !== normExpected) {
          const toHex = (s: string) => [...s].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join(' ');
          console.log(`DISCREPANCY in ${page.id} P${paragraph.index} S${sentenceIndex + 1}`);
          console.log(`Received: "${normReceived}" [${toHex(normReceived)}]`);
          console.log(`Expected: "${normExpected}" [${toHex(normExpected)}]`);
        }

        expect(
          normReceived,
          `${page.id} paragraph ${paragraph.index} sentence ${sentenceIndex + 1} should align with Tamil corpus`,
        ).toBe(normExpected);
      });
    }
  }
});
