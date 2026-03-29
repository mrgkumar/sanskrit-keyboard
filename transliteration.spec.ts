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
