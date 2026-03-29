import { expect, test } from '@playwright/test';

import { transliterate, detransliterate } from './src/lib/vedic/utils';
import { MAPPING_TRIE } from './src/lib/vedic/mapping';
import { loadCorpusSamples } from './test-support/transliterationCorpus';

const normalize = (value: string) => value.normalize('NFC');

const assertNoFailures = (
  failures: string[],
  label: string,
  totalChecked: number,
) => {
  expect(
    failures,
    `${label} failed for ${failures.length} of ${totalChecked} checked samples.\n${failures.join('\n')}`,
  ).toEqual([]);
};

test('Accent scheme maps forward with the new canonical inputs', () => {
  expect(transliterate("ga'").unicode).toBe('ग॑');
  expect(transliterate('ga_').unicode).toBe('ग॒');
  expect(transliterate("ga''").unicode).toBe('ग');
  expect(transliterate('ga"').unicode).toBe('ग');
  expect(transliterate("ga:''").unicode).toBe('गः');
});

test('Accent scheme maps backward with canonical outputs', () => {
  expect(detransliterate('ग॑')).toBe("ga'");
  expect(detransliterate('ग॒')).toBe('ga_');
  expect(detransliterate('ग')).toBe("ga''");
  expect(detransliterate('ग᳖')).toBe("ga''");
  expect(detransliterate('गः')).toBe("ga:''");
});

test('Canonical slash separators preserve forward hiatus distinctions', () => {
  expect(transliterate('a/i').unicode).toBe('अइ');
  expect(transliterate('A/o').unicode).toBe('आओ');
  expect(transliterate('goviMdabhaa/I').unicode).toBe('गोविंदभाई');
  expect(transliterate('o/ilara').unicode).toBe('ओइलर');
  expect(transliterate('raa/uta').unicode).toBe('राउत');
});

test('Canonical slash separators survive reverse transliteration', () => {
  expect(detransliterate('अइ')).toBe('a/i');
  expect(detransliterate('आओ')).toBe('A/o');
  expect(detransliterate('गोविंदभाई')).toBe('goviMdabhaa/I');
  expect(detransliterate('ओइलर')).toBe('o/ilara');
  expect(detransliterate('राउत')).toBe('raa/uta');
});

test('Canonical slash separators survive reverse transliteration across swara-marked hiatus', () => {
  expect(detransliterate('वाज॑सातय॒इति॒')).toBe("vaaja'saataya/_iti_");
  expect(detransliterate('पि॒तृभ्य॑इ॒दं')).toBe("pi_tR^ibhya/'i_daM");
  expect(detransliterate('अ॒ग्रे॒पु॒व॒इत्य॑ग्रे')).toBe("a_gre_pu_va/_itya'gre");
});

test('Vocalic r round-trips through dependent vowel forms', () => {
  expect(detransliterate('कृत')).toBe('kR^ita');
  expect(transliterate('kR^ita').unicode).toBe('कृत');
  expect(detransliterate('कॄ')).toBe('kR^I');
  expect(transliterate('kR^I').unicode).toBe('कॄ');
});

test('Distinct vedic anusvara variants keep separate round-trip aliases', () => {
  expect(transliterate('MM').unicode).toBe('ॖ');
  expect(detransliterate('ॖ')).toBe('MM');
  expect(transliterate('MM~').unicode).toBe('ꣳ');
  expect(detransliterate('ꣳ')).toBe('MM~');
  expect(transliterate('_MM~_').unicode).toBe('॒ꣳ॒');
  expect(detransliterate('॒ꣳ॒')).toBe('_MM~_');
  expect(transliterate('_M~M_').unicode).toBe('॒ं॒');
  expect(detransliterate('॒ं॒')).toBe('_M~M_');
});

test('Forward mapping preserves every direct mapping entry', () => {
  const failures: string[] = [];
  const seen = new Set<string>();

  for (const mapping of MAPPING_TRIE) {
    if (seen.has(mapping.itrans)) {
      continue;
    }

    seen.add(mapping.itrans);
    const actual = transliterate(mapping.itrans).unicode;
    if (normalize(actual) !== normalize(mapping.unicode)) {
      failures.push(
        `[${mapping.category}] ${mapping.itrans} => ${JSON.stringify(actual)} expected ${JSON.stringify(mapping.unicode)}`,
      );
    }
  }

  assertNoFailures(failures, 'Direct forward mapping', seen.size);
});

test('Forward mapping round-trips 2000 sampled corpus words from archive/example.txt', () => {
  const failures: string[] = [];
  const samples = loadCorpusSamples();

  for (const sample of samples) {
    const itrans = detransliterate(sample.token);
    const actual = transliterate(itrans).unicode;

    if (normalize(actual) !== normalize(sample.token)) {
      failures.push(
        `[${sample.difficulty} #${sample.index}] ${JSON.stringify(sample.token)} -> ${JSON.stringify(itrans)} -> ${JSON.stringify(actual)}`,
      );
    }
  }

  assertNoFailures(failures, 'Corpus forward mapping', samples.length);
});

test('Reverse mapping is stable for the same 2000 sampled corpus words', () => {
  const failures: string[] = [];
  const samples = loadCorpusSamples();

  for (const sample of samples) {
    const itrans = detransliterate(sample.token);
    const unicode = transliterate(itrans).unicode;
    const roundTrip = detransliterate(unicode);

    if (roundTrip !== itrans) {
      failures.push(
        `[${sample.difficulty} #${sample.index}] ${JSON.stringify(sample.token)} -> ${JSON.stringify(itrans)} -> ${JSON.stringify(roundTrip)}`,
      );
    }
  }

  assertNoFailures(failures, 'Corpus reverse mapping', samples.length);
});
