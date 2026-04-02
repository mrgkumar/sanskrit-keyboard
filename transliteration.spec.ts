import { expect, test } from '@playwright/test';

import { canonicalizeDevanagariPaste, formatSourceForOutput, transliterate, detransliterate } from './src/lib/vedic/utils';
import {
  canonicalizeAcceptedInputToken,
  getAcceptedInputs,
  getPreferredDisplayItrans,
  MAPPING_TRIE,
} from './src/lib/vedic/mapping';
import { canonicalizeCommittedEditorSource } from './src/store/useFlowStore';
import { loadCorpusSamples } from './test-support/transliterationCorpus';
import { loadSanTrainSamples } from './test-support/sanTrainCorpus';

const normalize = (value: string) => value.normalize('NFC');
const BARAHA_ALIAS_TOKENS = ['Ru', 'RU', '~lu', '~lU', 'K', 'G', 'c', 'C', 'J', 'P', 'B', 'ee', 'oo', 'ou', 'oum', '&', '~g', '~j'] as const;

const collectBarahaCoverage = (values: string[]) => {
  const aliasCounts = Object.fromEntries(BARAHA_ALIAS_TOKENS.map((alias) => [alias, 0])) as Record<
    (typeof BARAHA_ALIAS_TOKENS)[number],
    number
  >;

  let changed = 0;

  for (const value of values) {
    const canonical = detransliterate(value);
    const baraha = formatSourceForOutput(canonical, { outputScheme: 'baraha-compatible' });

    if (canonical !== baraha) {
      changed += 1;
    }

    for (const alias of BARAHA_ALIAS_TOKENS) {
      if (baraha.includes(alias)) {
        aliasCounts[alias] += 1;
      }
    }
  }

  return {
    changed,
    aliasCounts,
  };
};

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

test('Baraha-compatible aliases map forward while reverse stays canonical', () => {
  expect(transliterate('Ru').unicode).toBe(transliterate('R^i').unicode);
  expect(transliterate('RU').unicode).toBe(transliterate('R^I').unicode);
  expect(transliterate('~lu').unicode).toBe(transliterate('L^i').unicode);
  expect(transliterate('~lU').unicode).toBe(transliterate('L^I').unicode);
  expect(transliterate('ee').unicode).toBe(transliterate('I').unicode);
  expect(transliterate('oo').unicode).toBe(transliterate('U').unicode);
  expect(transliterate('ou').unicode).toBe(transliterate('au').unicode);
  expect(transliterate('oum').unicode).toBe(transliterate('OM').unicode);
  expect(transliterate('&').unicode).toBe(transliterate('.a').unicode);
  expect(transliterate('K').unicode).toBe(transliterate('kh').unicode);
  expect(transliterate('C').unicode).toBe(transliterate('Ch').unicode);
  expect(transliterate('~g').unicode).toBe(transliterate('~N').unicode);
  expect(transliterate('~j').unicode).toBe(transliterate('~n').unicode);

  expect(detransliterate(transliterate('Ru').unicode)).toBe('RRi');
  expect(detransliterate(transliterate('~lu').unicode)).toBe('LLi');
  expect(detransliterate(transliterate('ee').unicode)).toBe('I');
  expect(detransliterate(transliterate('ou').unicode)).toBe('au');
  expect(detransliterate(transliterate('oum').unicode)).toBe('OM');
  expect(detransliterate(transliterate('&').unicode)).toBe('.a');
  expect(detransliterate(transliterate('K').unicode)).toBe('kh');
  expect(detransliterate(transliterate('C').unicode)).toBe('Ch');
  expect(detransliterate(transliterate('~g').unicode)).toBe('~N');
  expect(detransliterate(transliterate('~j').unicode)).toBe('~n');
});

test('Devanagari paste canonicalization stays canonical even when aliases are accepted for input', () => {
  expect(canonicalizeDevanagariPaste('कृत')).toBe('kR^ita');
  expect(canonicalizeDevanagariPaste('ॠ')).toBe('RRI');
  expect(canonicalizeDevanagariPaste('ॡ')).toBe('LLI');
  expect(canonicalizeDevanagariPaste('ॐ')).toBe('OM');
  expect(canonicalizeDevanagariPaste('ऽ')).toBe('.a');
  expect(canonicalizeDevanagariPaste('छ')).toBe('Cha');
});

test('Preferred display labels stay canonical while accepted inputs include aliases', () => {
  expect(getPreferredDisplayItrans('Ru')).toBe('R^i');
  expect(getPreferredDisplayItrans('K')).toBe('kh');
  expect(getPreferredDisplayItrans('&')).toBe('.a');
  expect(getAcceptedInputs('R^i')).toEqual(expect.arrayContaining(['R^i', 'Ru']));
  expect(getAcceptedInputs('kh')).toEqual(expect.arrayContaining(['kh', 'K']));
  expect(getAcceptedInputs('.a')).toEqual(expect.arrayContaining(['.a', '&']));
});

test('Accepted alias tokens canonicalize to canonical source tokens', () => {
  expect(canonicalizeAcceptedInputToken('Ru')).toBe('R^i');
  expect(canonicalizeAcceptedInputToken('RU')).toBe('R^I');
  expect(canonicalizeAcceptedInputToken('~lu')).toBe('L^i');
  expect(canonicalizeAcceptedInputToken('~lU')).toBe('L^I');
  expect(canonicalizeAcceptedInputToken('Kavi')).toBe('khavi');
  expect(canonicalizeAcceptedInputToken('&tman')).toBe('.atman');
  expect(canonicalizeAcceptedInputToken('oum')).toBe('OM');
});

test('Committed editor tokens are canonicalized at delimiter boundaries', () => {
  expect(canonicalizeCommittedEditorSource('Ru ', 3, 'Ru')).toEqual({
    source: 'R^i ',
    caret: 4,
    canonicalBuffer: 'R^i',
  });
  expect(canonicalizeCommittedEditorSource('&tman ', 6, '&tman')).toEqual({
    source: '.atman ',
    caret: 7,
    canonicalBuffer: '.atman',
  });
  expect(canonicalizeCommittedEditorSource('Kavi|', 5, 'Kavi')).toEqual({
    source: 'khavi|',
    caret: 6,
    canonicalBuffer: 'khavi',
  });
});

test('true-conflict aliases only activate under the Baraha-compatible input scheme', () => {
  expect(transliterate('c').unicode).toBe('c');
  expect(transliterate('c', { inputScheme: 'baraha-compatible' }).unicode).toBe(transliterate('ch').unicode);
  expect(canonicalizeAcceptedInputToken('candra')).toBe('candra');
  expect(canonicalizeAcceptedInputToken('candra', 'baraha-compatible')).toBe('chandra');
  expect(getAcceptedInputs('ch')).not.toContain('c');
  expect(getAcceptedInputs('ch', 'baraha-compatible')).toContain('c');
  expect(canonicalizeCommittedEditorSource('c ', 2, 'c', 'baraha-compatible')).toEqual({
    source: 'ch ',
    caret: 3,
    canonicalBuffer: 'ch',
  });
});

test('output formatting stays explicit and does not change canonical paste behavior', () => {
  expect(formatSourceForOutput('R^i kh ch Ch OM .a ~N ~n')).toBe('R^i kh ch Ch OM .a ~N ~n');
  expect(formatSourceForOutput('R^i kh ch Ch OM .a ~N ~n', { outputScheme: 'baraha-compatible' })).toBe(
    'Ru K c C oum & ~g ~j'
  );
  expect(detransliterate('कृत')).toBe('kR^ita');
  expect(detransliterate('कृत', { outputScheme: 'baraha-compatible' })).toBe('kRuta');
  expect(detransliterate('छ', { outputScheme: 'baraha-compatible' })).toBe('Ca');
  expect(canonicalizeDevanagariPaste('कृत')).toBe('kR^ita');
});

test('Baraha-compatible output round-trips when paired with the matching input scheme', () => {
  const canonicalSource = 'R^i kh ch Ch OM .a ~N ~n';
  const barahaOutput = formatSourceForOutput(canonicalSource, { outputScheme: 'baraha-compatible' });

  expect(transliterate(barahaOutput, { inputScheme: 'baraha-compatible' }).unicode).toBe(
    transliterate(canonicalSource).unicode
  );
});

test('Baraha om alias does not match inside ordinary words and reverse keeps canonical au', () => {
  expect(transliterate('stoumi').unicode).toBe('स्तौमि');
  expect(canonicalizeAcceptedInputToken('stoumi')).toBe('staumi');
  expect(detransliterate('स्तौमि')).toBe('staumi');
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

test('Baraha-style forward mapping self-validates against 2000 sampled san_train words', async () => {
  const failures: string[] = [];
  const samples = await loadSanTrainSamples();
  const coverage = collectBarahaCoverage(samples.map((sample) => sample.token));

  for (const sample of samples) {
    const canonical = detransliterate(sample.token);
    const baraha = formatSourceForOutput(canonical, { outputScheme: 'baraha-compatible' });
    const actual = transliterate(baraha, { inputScheme: 'baraha-compatible' }).unicode;

    if (normalize(actual) !== normalize(sample.token)) {
      failures.push(
        `[#${sample.index} ${sample.id}] ${JSON.stringify(sample.token)} -> ${JSON.stringify(canonical)} -> ${JSON.stringify(baraha)} -> ${JSON.stringify(actual)}`
      );
    }
  }

  expect(
    coverage.changed,
    `Expected Baraha formatting to change a substantial portion of sampled san_train rows, but only ${coverage.changed} of ${samples.length} changed.`
  ).toBeGreaterThanOrEqual(500);
  expect(coverage.aliasCounts.Ru).toBeGreaterThan(0);
  expect(coverage.aliasCounts.c).toBeGreaterThan(0);
  expect(coverage.aliasCounts.B).toBeGreaterThan(0);
  expect(coverage.aliasCounts.ou).toBeGreaterThan(0);
  expect(coverage.aliasCounts['&']).toBeGreaterThan(0);
  expect(coverage.aliasCounts['~g']).toBeGreaterThan(0);
  expect(coverage.aliasCounts['~j']).toBeGreaterThan(0);

  assertNoFailures(failures, 'Baraha san_train forward self-validation', samples.length);
});

test('Baraha-style reverse mapping self-validates against 2000 sampled san_train words', async () => {
  const failures: string[] = [];
  const samples = await loadSanTrainSamples();

  for (const sample of samples) {
    const baraha = detransliterate(sample.token, { outputScheme: 'baraha-compatible' });
    const actual = transliterate(baraha, { inputScheme: 'baraha-compatible' }).unicode;

    if (normalize(actual) !== normalize(sample.token)) {
      failures.push(
        `[#${sample.index} ${sample.id}] ${JSON.stringify(sample.token)} -> ${JSON.stringify(baraha)} -> ${JSON.stringify(actual)}`
      );
    }
  }

  assertNoFailures(failures, 'Baraha san_train reverse self-validation', samples.length);
});
