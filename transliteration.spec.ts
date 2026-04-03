import { expect, test } from '@playwright/test';

import {
  canonicalizeDevanagariPaste,
  formatSourceForOutput,
  formatSourceForPrimaryOutput,
  getCopySourceControlText,
  transliterate,
  detransliterate,
} from './src/lib/vedic/utils';
import {
  canonicalizeAcceptedInputToken,
  DEFAULT_OUTPUT_TARGET_SETTINGS,
  getOutputTargetQuickLabels,
  getOutputTargetSettingsFromLegacyOutputScheme,
  getPrimaryCopyTargetDescriptor,
  normalizeOutputTargetSettings,
  OUTPUT_TARGET_CONTROL_LABELS,
  OUTPUT_TARGET_STYLE_OPTIONS,
  OUTPUT_TARGET_VALUE_LABELS,
  resolveLegacyOutputSchemeBridge,
  setComparisonOutputScript,
  setPrimaryOutputScript,
  getAcceptedInputs,
  OUTPUT_SCHEME_LABELS,
  OUTPUT_SCHEME_UI_METADATA,
  getPreferredDisplayItrans,
  MAPPING_TRIE,
} from './src/lib/vedic/mapping';
import {
  canonicalizeCommittedEditorSource,
  DEFAULT_DISPLAY_SETTINGS,
  normalizeDisplaySettings,
  useFlowStore,
} from './src/store/useFlowStore';
import { loadCorpusSamples } from './test-support/transliterationCorpus';
import { loadSanTrainSamples } from './test-support/sanTrainCorpus';
import {
  BARAHA_TAMIL_COLLAPSED_FAMILIES,
  BARAHA_TAMIL_CONTROL_TOKENS,
  BARAHA_TAMIL_DISTINCT_LETTER_FIXTURES,
  BARAHA_TAMIL_EXAMPLE_FIXTURES,
  BARAHA_TAMIL_PHONETIC_PAGE_FIXTURES,
  BARAHA_TAMIL_SOURCE_URLS,
} from './test-support/barahaTamilFixtures';
import {
  TAMIL_PRECISION_ASCII_FALLBACK_GOLDENS,
  TAMIL_PRECISION_RICH_GOLDENS,
} from './test-support/tamilPrecisionGoldens';
import {
  canonicalizeTamilPrecisionFragment,
  isTamilPrecisionSuperscriptFallback,
  TAMIL_PRECISION_MARK_TOKENS,
  TAMIL_PRECISION_MODE_NAMES,
  TAMIL_PRECISION_PHASE_ONE_EXCLUSIONS,
  TAMIL_PRECISION_RESERVED_BARAHA_CONTROL_TOKENS,
  TAMIL_PRECISION_SUPERSCRIPT_MARKERS,
  TAMIL_PRECISION_VOCALIC_TOKENS,
} from './test-support/tamilPrecisionNotation';

const normalize = (value: string) => value.normalize('NFC');
const BARAHA_ALIAS_TOKENS = ['Ru', 'RU', '~lu', '~lU', 'K', 'G', 'c', 'C', 'J', 'P', 'B', 'ee', 'oo', 'ou', 'oum', '&', '~g', '~j'] as const;
const TAMIL_PRECISION_GATE4_MIXED_FIXTURES = [
  ['ka', 'க'],
  ['kha', 'க²'],
  ['ga', 'க³'],
  ['gha', 'க⁴'],
  ['cha', 'ச'],
  ['jha', 'ஜ²'],
  ['R^i', 'ரு¹'],
  ['L^i', 'லு¹'],
  ['M', 'ஂ'],
  [':', 'ஃ'],
  ['gItA', 'க³ீதா'],
  ['dharma', 'த⁴ர்ம'],
  ['bhakti', 'ப⁴க்தி'],
  ['lakShmI', 'லக்ஷ்மீ'],
  ['j~nAna', 'ஜ்ஞாந'],
  ['amR^ita', 'அம்ரு¹த'],
  ['kR^ita', 'க்ரு¹த'],
  ['kL^ipta', 'க்லு¹ப்த'],
  ['saMskR^ita', 'ஸஂஸ்க்ரு¹த'],
  ['guru:', 'க³ுருஃ'],
  ['shrI', 'ஶ்ரீ'],
] as const;
const TAMIL_PRECISION_GATE4_DEVANAGARI_FIXTURES = [
  ['ऋ', 'R^i'],
  ['ऌ', 'L^i'],
  ['क', 'ka'],
  ['गीता', 'gItA'],
  ['धर्म', 'dharma'],
  ['भक्ति', 'bhakti'],
  ['लक्ष्मी', 'lakShmI'],
  ['अमृत', 'amR^ita'],
  ['संस्कृत', 'saMskR^ita'],
  ['गुरुः', 'guru:'],
  ['श्री', 'shrI'],
] as const;

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

test('Gate 0 freezes Tamil precision mode names and phase-1 exclusions', () => {
  expect(TAMIL_PRECISION_MODE_NAMES).toEqual({
    compatibility: 'baraha-tamil',
    precision: 'sanskrit-tamil-precision',
  });
  expect(TAMIL_PRECISION_PHASE_ONE_EXCLUSIONS).toEqual([
    'vedic-accents-output',
    'tamil-script-input',
  ]);
});

test('Gate 0 freezes Tamil precision superscript and mark notation', () => {
  expect(TAMIL_PRECISION_SUPERSCRIPT_MARKERS).toEqual({
    aspiratedVoiceless: { rich: '²', fallback: '^2' },
    voicedUnaspirated: { rich: '³', fallback: '^3' },
    voicedAspirated: { rich: '⁴', fallback: '^4' },
  });
  expect(TAMIL_PRECISION_MARK_TOKENS).toEqual({
    M: 'ஂ',
    ':': 'ஃ',
  });
  expect(TAMIL_PRECISION_RESERVED_BARAHA_CONTROL_TOKENS).toEqual(['^', '^^']);
});

test('Gate 0 freezes exact Tamil precision fallback fragments without colliding with Baraha control tokens', () => {
  expect(canonicalizeTamilPrecisionFragment('க²')).toBe('க²');
  expect(canonicalizeTamilPrecisionFragment('க^2')).toBe('க²');
  expect(canonicalizeTamilPrecisionFragment('க^3')).toBe('க³');
  expect(canonicalizeTamilPrecisionFragment('க^4')).toBe('க⁴');
  expect(isTamilPrecisionSuperscriptFallback('க^2')).toBe(true);
  expect(isTamilPrecisionSuperscriptFallback('க^3')).toBe(true);
  expect(isTamilPrecisionSuperscriptFallback('க^4')).toBe(true);
  expect(canonicalizeTamilPrecisionFragment('^')).toBeNull();
  expect(canonicalizeTamilPrecisionFragment('^^')).toBeNull();
  expect(isTamilPrecisionSuperscriptFallback('^')).toBe(false);
  expect(isTamilPrecisionSuperscriptFallback('^^')).toBe(false);

  for (const token of Object.values(TAMIL_PRECISION_VOCALIC_TOKENS)) {
    expect(canonicalizeTamilPrecisionFragment(token.rich)).toBe(token.rich);
    expect(canonicalizeTamilPrecisionFragment(token.fallback)).toBe(token.rich);
  }
});

test('Gate 0 keeps Tamil precision vocalic markers injective and separate from ordinary Tamil', () => {
  expect(TAMIL_PRECISION_VOCALIC_TOKENS).toEqual({
    'R^i': { rich: 'ரு¹', fallback: 'ரு<R>', ordinaryTamil: 'ரு' },
    'R^I': { rich: 'ரூ¹', fallback: 'ரூ<R>', ordinaryTamil: 'ரூ' },
    'L^i': { rich: 'லு¹', fallback: 'லு<L>', ordinaryTamil: 'லு' },
    'L^I': { rich: 'லூ¹', fallback: 'லூ<L>', ordinaryTamil: 'லூ' },
  });

  const richTokens = new Set<string>();
  const fallbackTokens = new Set<string>();

  for (const [canonicalRoman, token] of Object.entries(TAMIL_PRECISION_VOCALIC_TOKENS)) {
    expect(token.rich).not.toBe(token.ordinaryTamil);
    expect(token.fallback).not.toBe(token.ordinaryTamil);
    expect(canonicalizeTamilPrecisionFragment(token.ordinaryTamil)).toBeNull();
    expect(canonicalizeTamilPrecisionFragment(token.rich)).toBe(token.rich);
    expect(canonicalizeTamilPrecisionFragment(token.fallback)).toBe(token.rich);
    expect(canonicalizeTamilPrecisionFragment(token.fallback)).not.toBe(token.ordinaryTamil);
    expect(canonicalizeTamilPrecisionFragment(canonicalRoman)).toBeNull();
    expect(richTokens.has(token.rich)).toBe(false);
    expect(fallbackTokens.has(token.fallback)).toBe(false);
    richTokens.add(token.rich);
    fallbackTokens.add(token.fallback);
  }
});

test('Gate 0 freezes output-target labels and state defaults', () => {
  expect(OUTPUT_TARGET_CONTROL_LABELS).toEqual({
    readAs: 'Read As',
    compare: 'Compare',
    primaryScript: 'Primary Script',
    compareWith: 'Compare With',
    romanStyle: 'Roman Style',
    tamilMode: 'Tamil Mode',
  });
  expect(OUTPUT_TARGET_VALUE_LABELS).toEqual({
    roman: 'Roman',
    devanagari: 'Devanagari',
    tamil: 'Tamil',
    off: 'Off',
    canonical: 'Canonical',
    baraha: 'Baraha',
    precision: 'Precision',
  });
  expect(DEFAULT_OUTPUT_TARGET_SETTINGS).toEqual({
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
  expect(OUTPUT_TARGET_STYLE_OPTIONS).toEqual({
    roman: ['canonical', 'baraha'],
    tamil: ['precision'],
  });
});

test('Gate 0 keeps comparison off by default and never auto-enables it when Read As changes', () => {
  expect(DEFAULT_OUTPUT_TARGET_SETTINGS.comparisonOutputScript).toBe('off');
  expect(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'devanagari')).toEqual({
    ...DEFAULT_OUTPUT_TARGET_SETTINGS,
    primaryOutputScript: 'devanagari',
  });
  expect(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'tamil')).toEqual({
    ...DEFAULT_OUTPUT_TARGET_SETTINGS,
    primaryOutputScript: 'tamil',
  });
});

test('Gate 0 fixes Tamil Mode to precision in phase 1', () => {
  expect(OUTPUT_TARGET_STYLE_OPTIONS.tamil).toEqual(['precision']);
  expect(DEFAULT_OUTPUT_TARGET_SETTINGS.tamilOutputStyle).toBe('precision');
  expect(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'tamil').tamilOutputStyle).toBe('precision');
});

test('Gate 0 ties copy-target semantics to Read As and isolates Compare from copy-target changes', () => {
  expect(getPrimaryCopyTargetDescriptor(DEFAULT_OUTPUT_TARGET_SETTINGS)).toEqual({
    script: 'roman',
    styleLabel: 'Canonical',
    label: 'Roman (Canonical)',
    legacyOutputScheme: 'canonical-vedic',
  });
  expect(
    getPrimaryCopyTargetDescriptor({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      romanOutputStyle: 'baraha',
    }),
  ).toEqual({
    script: 'roman',
    styleLabel: 'Baraha',
    label: 'Roman (Baraha)',
    legacyOutputScheme: 'baraha-compatible',
  });
  expect(
    getPrimaryCopyTargetDescriptor(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'tamil')),
  ).toEqual({
    script: 'tamil',
    styleLabel: 'Precision',
    label: 'Tamil (Precision)',
    legacyOutputScheme: 'sanskrit-tamil-precision',
  });
  expect(
    getPrimaryCopyTargetDescriptor(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'devanagari')),
  ).toEqual({
    script: 'devanagari',
    styleLabel: null,
    label: 'Devanagari',
    legacyOutputScheme: null,
  });
  expect(
    getPrimaryCopyTargetDescriptor(
      setComparisonOutputScript(
        {
          ...DEFAULT_OUTPUT_TARGET_SETTINGS,
          romanOutputStyle: 'baraha',
        },
        'tamil',
      ),
    ),
  ).toEqual({
    script: 'roman',
    styleLabel: 'Baraha',
    label: 'Roman (Baraha)',
    legacyOutputScheme: 'baraha-compatible',
  });
});

test('Gate 0 composes the expected visible Read As and Compare labels', () => {
  expect(getOutputTargetQuickLabels(DEFAULT_OUTPUT_TARGET_SETTINGS)).toEqual({
    readAs: 'Read As: Roman',
    compare: 'Compare: Off',
  });
  expect(
    getOutputTargetQuickLabels(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'devanagari')),
  ).toEqual({
    readAs: 'Read As: Devanagari',
    compare: 'Compare: Off',
  });
  expect(
    getOutputTargetQuickLabels(setPrimaryOutputScript(DEFAULT_OUTPUT_TARGET_SETTINGS, 'tamil')),
  ).toEqual({
    readAs: 'Read As: Tamil',
    compare: 'Compare: Off',
  });
});

test('Gate 0 keeps legacy store outputScheme behavior intact before migration starts', () => {
  const previousSnapshot = useFlowStore.getState().exportSessionSnapshot();
  const legacyDisplaySettings = { ...previousSnapshot.displaySettings! } as Partial<
    NonNullable<typeof previousSnapshot.displaySettings>
  >;
  delete legacyDisplaySettings.primaryOutputScript;
  delete legacyDisplaySettings.comparisonOutputScript;
  delete legacyDisplaySettings.romanOutputStyle;
  delete legacyDisplaySettings.tamilOutputStyle;

  try {
    useFlowStore.getState().loadSessionSnapshot({
      ...previousSnapshot,
      displaySettings: {
        ...legacyDisplaySettings,
        outputScheme: 'baraha-compatible',
      } as NonNullable<typeof previousSnapshot.displaySettings>,
    });
    expect(useFlowStore.getState().displaySettings.outputScheme).toBe('baraha-compatible');

    useFlowStore.getState().loadSessionSnapshot({
      ...previousSnapshot,
      displaySettings: {
        ...legacyDisplaySettings,
        outputScheme: 'sanskrit-tamil-precision',
      } as NonNullable<typeof previousSnapshot.displaySettings>,
    });
    expect(useFlowStore.getState().displaySettings.outputScheme).toBe('sanskrit-tamil-precision');
  } finally {
    useFlowStore.getState().loadSessionSnapshot(previousSnapshot);
  }
});

test('Gate 0 keeps existing Sanskrit output schemes free of Tamil precision notation', () => {
  const canonicalOutput = formatSourceForOutput('kR^ita M H');
  const barahaOutput = formatSourceForOutput('kR^ita M H', { outputScheme: 'baraha-compatible' });

  expect(canonicalOutput).toBe('kR^ita M H');
  expect(barahaOutput).toBe('kRuta M H');
  expect(/[ஂஃ¹²³⁴]/u.test(canonicalOutput)).toBe(false);
  expect(/[ஂஃ¹²³⁴]/u.test(barahaOutput)).toBe(false);
});

test('Gate 1 migrates all legacy outputScheme values into the new output-target state', () => {
  expect(getOutputTargetSettingsFromLegacyOutputScheme('canonical-vedic')).toEqual({
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
  expect(getOutputTargetSettingsFromLegacyOutputScheme('baraha-compatible')).toEqual({
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'baraha',
    tamilOutputStyle: 'precision',
  });
  expect(getOutputTargetSettingsFromLegacyOutputScheme('sanskrit-tamil-precision')).toEqual({
    primaryOutputScript: 'tamil',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
});

test('Gate 1 lets explicit new fields override stale legacy outputScheme values', () => {
  expect(
    normalizeOutputTargetSettings({
      outputScheme: 'baraha-compatible',
      primaryOutputScript: 'tamil',
      comparisonOutputScript: 'off',
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }),
  ).toEqual({
    primaryOutputScript: 'tamil',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
  expect(
    normalizeDisplaySettings({
      ...DEFAULT_DISPLAY_SETTINGS,
      outputScheme: 'baraha-compatible',
      primaryOutputScript: 'tamil',
      comparisonOutputScript: 'off',
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }).outputScheme,
  ).toBe('sanskrit-tamil-precision');
});

test('Gate 1 keeps mixed snapshots on new-state defaults instead of inheriting stale legacy outputScheme values', () => {
  expect(
    normalizeOutputTargetSettings({
      outputScheme: 'baraha-compatible',
      primaryOutputScript: 'roman',
    }),
  ).toEqual({
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
  expect(
    normalizeDisplaySettings({
      ...DEFAULT_DISPLAY_SETTINGS,
      outputScheme: 'sanskrit-tamil-precision',
      primaryOutputScript: 'roman',
      comparisonOutputScript: 'off',
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }).outputScheme,
  ).toBe('canonical-vedic');
});

test('Gate 1 keeps default display settings and input scheme initialization consistent', () => {
  expect(DEFAULT_DISPLAY_SETTINGS).toMatchObject({
    inputScheme: 'canonical-vedic',
    outputScheme: 'canonical-vedic',
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
  expect(normalizeDisplaySettings(undefined)).toMatchObject({
    inputScheme: 'canonical-vedic',
    outputScheme: 'canonical-vedic',
    primaryOutputScript: 'roman',
    comparisonOutputScript: 'off',
    romanOutputStyle: 'canonical',
    tamilOutputStyle: 'precision',
  });
});

test('Gate 1 keeps new snapshots stable across store save and load round trips', () => {
  const previousSnapshot = useFlowStore.getState().exportSessionSnapshot();

  try {
    useFlowStore.getState().loadSessionSnapshot({
      ...previousSnapshot,
      displaySettings: {
        ...DEFAULT_DISPLAY_SETTINGS,
        primaryOutputScript: 'tamil',
        comparisonOutputScript: 'off',
        romanOutputStyle: 'canonical',
        tamilOutputStyle: 'precision',
        outputScheme: 'sanskrit-tamil-precision',
      },
    });

    const exported = useFlowStore.getState().exportSessionSnapshot();
    expect(exported.displaySettings).toMatchObject({
      primaryOutputScript: 'tamil',
      comparisonOutputScript: 'off',
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
      outputScheme: 'sanskrit-tamil-precision',
    });

    useFlowStore.getState().loadSessionSnapshot(exported);
    expect(useFlowStore.getState().displaySettings).toMatchObject({
      primaryOutputScript: 'tamil',
      comparisonOutputScript: 'off',
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
      outputScheme: 'sanskrit-tamil-precision',
    });
  } finally {
    useFlowStore.getState().loadSessionSnapshot(previousSnapshot);
  }
});

test('Gate 1 keeps the legacy outputScheme bridge derived from the active output-target state', () => {
  expect(resolveLegacyOutputSchemeBridge(DEFAULT_OUTPUT_TARGET_SETTINGS)).toBe('canonical-vedic');
  expect(
    resolveLegacyOutputSchemeBridge({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      romanOutputStyle: 'baraha',
    }),
  ).toBe('baraha-compatible');
  expect(
    resolveLegacyOutputSchemeBridge({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'tamil',
    }),
  ).toBe('sanskrit-tamil-precision');
  expect(
    resolveLegacyOutputSchemeBridge(
      {
        ...DEFAULT_OUTPUT_TARGET_SETTINGS,
        primaryOutputScript: 'devanagari',
      },
      'baraha-compatible',
    ),
  ).toBe('canonical-vedic');
});

test('Gate 1 drives active store state from the new output-target setters and derives the legacy bridge from them', () => {
  const previousSnapshot = useFlowStore.getState().exportSessionSnapshot();

  try {
    useFlowStore.getState().setPrimaryOutputScript('tamil');
    expect(useFlowStore.getState().displaySettings).toMatchObject({
      primaryOutputScript: 'tamil',
      outputScheme: 'sanskrit-tamil-precision',
    });

    useFlowStore.getState().setPrimaryOutputScript('roman');
    useFlowStore.getState().setRomanOutputStyle('baraha');
    expect(useFlowStore.getState().displaySettings).toMatchObject({
      primaryOutputScript: 'roman',
      romanOutputStyle: 'baraha',
      outputScheme: 'baraha-compatible',
    });

    useFlowStore.getState().setComparisonOutputScript('devanagari');
    expect(useFlowStore.getState().displaySettings).toMatchObject({
      comparisonOutputScript: 'devanagari',
      outputScheme: 'baraha-compatible',
    });

    useFlowStore.getState().setPrimaryOutputScript('devanagari');
    expect(useFlowStore.getState().displaySettings).toMatchObject({
      primaryOutputScript: 'devanagari',
      outputScheme: 'canonical-vedic',
    });
  } finally {
    useFlowStore.getState().loadSessionSnapshot(previousSnapshot);
  }
});

test('Gate 1 freezes Baraha Tamil source fixtures and required token classes', () => {
  expect(BARAHA_TAMIL_SOURCE_URLS).toEqual({
    phonetic: 'https://baraha.com/help/Keyboards/tam-phonetic.htm',
    examples: 'https://baraha.com/help/Keyboards/tam-examples.htm',
  });
  expect(BARAHA_TAMIL_CONTROL_TOKENS).toEqual(['Rs', '^', '^^', '~~', '~#', '~$']);
  expect(BARAHA_TAMIL_COLLAPSED_FAMILIES).toEqual({
    velars: ['k', 'K', 'kh', 'g', 'G', 'gh'],
    palatals: ['c', 'ch', 'C', 'Ch'],
    retroflexes: ['T', 'Th', 'D', 'Dh'],
    dentals: ['t', 'th', 'd', 'dh'],
    labials: ['p', 'P', 'ph', 'b', 'B', 'bh'],
  });
  expect(BARAHA_TAMIL_DISTINCT_LETTER_FIXTURES).toEqual({
    jFamily: ['j', 'jh', 'J'],
    shaFamily: ['S', 'sh'],
    Sha: ['Sh'],
    sa: ['s'],
    haFamily: ['h', '~h'],
    kSha: ['kSha'],
    SrI: ['SrI'],
  });
});

test('Gate 1 freezes Baraha Tamil phonetic mappings and example fixtures without precision markers', () => {
  expect(BARAHA_TAMIL_PHONETIC_PAGE_FIXTURES).toEqual({
    vowels: [
      ['அ', ['a']],
      ['ஆ', ['A', 'aa']],
      ['இ', ['i']],
      ['ஈ', ['I', 'ee']],
      ['உ', ['u']],
      ['ஊ', ['U', 'oo']],
      ['எ', ['e']],
      ['ஏ', ['E']],
      ['ஐ', ['ai']],
      ['ஒ', ['o']],
      ['ஓ', ['O']],
      ['ஔ', ['au', 'ou']],
      ['ஃ', ['H']],
    ],
    consonants: [
      ['க்', ['k', 'K', 'kh', 'g', 'G', 'gh']],
      ['ங்', ['~g']],
      ['ச்', ['c', 'ch', 'C', 'Ch']],
      ['ஞ்', ['~j']],
      ['ட்', ['T', 'Th', 'D', 'Dh']],
      ['ண்', ['N']],
      ['த்', ['t', 'th', 'd', 'dh']],
      ['ந்', ['~n']],
      ['ப்', ['p', 'P', 'ph', 'b', 'B', 'bh']],
      ['ம்', ['m', 'M']],
      ['ய்', ['y', 'Y']],
      ['ர்', ['r']],
      ['ல்', ['l']],
      ['வ்', ['v', 'w']],
      ['ழ்', ['zh', 'Lx']],
      ['ள்', ['L']],
      ['ற்', ['R', 'rx']],
      ['ன்', ['n']],
      ['ஜ்', ['j', 'jh', 'J']],
      ['ஶ்', ['S', 'sh']],
      ['ஷ்', ['Sh']],
      ['ஸ்', ['s']],
      ['ஹ்', ['h', '~h']],
      ['க்ஷ', ['kSha']],
      ['ஶ்ரீ', ['SrI']],
    ],
  });
  expect(BARAHA_TAMIL_EXAMPLE_FIXTURES).toEqual([
    { tamil: 'வணக்கம்', roman: 'vaNakkam' },
    { tamil: '(காலை) வணக்கம்', roman: '(kAlai) vaNakkam' },
    { tamil: 'சென்று வருகிறேன்', roman: 'cenRu varukiREn' },
    { tamil: 'நன்றி', roman: '~nanRi' },
    { tamil: 'நீ எப்படி இருக்கிறாய்', roman: '~nI eppaDi irukkiRAy' },
    { tamil: 'நான் நல்லபடியாக இருக்கிறேன். நன்றி', roman: '~nAn ~nallapaDiyAka irukkiREn. ~nanRi' },
    { tamil: 'மன்னியுங்கள்', roman: 'manniyu~gkaL' },
    { tamil: 'குளிர்ச்சியாக உள்ளது', roman: 'kuLircciyAka uLLatu' },
    { tamil: 'அது சூடாக உள்ளது', roman: 'atu cUDAka uLLatu' },
    { tamil: 'மழை பெய்து கொண்டிருக்கிறது', roman: 'mazhai peytu koNTirukkiRatu' },
    { tamil: 'என்னுடைய பெயர் முருகன்', roman: 'ennuDaiya peyar murukan' },
    { tamil: 'நீ எங்கே இருக்கிறாய்?', roman: '~nI e~gkE irukkiRAy?' },
    { tamil: 'அந்த கட்டிடம் உயரமானது', roman: 'a~nta kaTTiTam uyaramAnatu' },
    { tamil: 'நான் பறவைகளை நேசிக்கிறேன்', roman: '~nAn paRavaikaLai ~nEcikkiREn' },
    { tamil: 'பேருந்து நிலையம் இங்கிருந்து எவ்வளவு தொலைவில் உள்ளது?', roman: 'pEru~ntu ~nilaiyam i~gkiru~ntu evvaLavu tolaivil uLLatu?' },
    { tamil: 'அவர் வந்தவுடன் என்னை திரும்ப அழைக்குமாறு தயவு செய்து சொல்லவும்', roman: 'avar va~ntavuDan ennai tirumpa azhaikkumARu tayavu ceytu collavum' },
    { tamil: 'உணவு நன்றாக உள்ளது', roman: 'uNavu ~nanRAka uLLatu' },
    { tamil: 'வாழ்த்துக்கள்', roman: 'vAzhttukkaL' },
    { tamil: 'இனிய புத்தாண்டு வாழ்துகள்', roman: 'iniya puttANTu vAzhtukaL' },
    { tamil: 'திருமண வாழ்த்துக்கள்', roman: 'tirumaNa vAzhttukkaL' },
  ]);

  for (const example of BARAHA_TAMIL_EXAMPLE_FIXTURES) {
    expect(example.roman).not.toMatch(/[¹²³⁴]/u);
    expect(example.roman).not.toContain('<R>');
    expect(example.roman).not.toContain('<L>');
    expect(example.roman).not.toContain('^2');
    expect(example.roman).not.toContain('^3');
    expect(example.roman).not.toContain('^4');
  }
});

test('Gate 1 keeps Baraha Tamil control tokens outside the frozen precision fragment contract', () => {
  for (const token of BARAHA_TAMIL_CONTROL_TOKENS) {
    expect(canonicalizeTamilPrecisionFragment(token)).toBeNull();
    expect(isTamilPrecisionSuperscriptFallback(token)).toBe(false);
    expect(token).not.toContain('^2');
    expect(token).not.toContain('^3');
    expect(token).not.toContain('^4');
  }
});

test('Gate 2 formats canonical Roman into frozen Tamil precision rich goldens', () => {
  for (const [canonical, expected] of TAMIL_PRECISION_RICH_GOLDENS) {
    expect(
      formatSourceForOutput(canonical, { outputScheme: 'sanskrit-tamil-precision' }),
      `${canonical} should format to ${expected}`,
    ).toBe(expected);
  }
});

test('Gate 2 formats canonical Roman into Tamil precision ASCII-safe fallback goldens', () => {
  for (const [canonical, expected] of TAMIL_PRECISION_ASCII_FALLBACK_GOLDENS) {
    expect(
      formatSourceForOutput(canonical, {
        outputScheme: 'sanskrit-tamil-precision',
        tamilPrecisionAsciiFallback: true,
      }),
      `${canonical} should format to ASCII-safe ${expected}`,
    ).toBe(expected);
  }
});

test('Gate 2 normalizes accepted aliases to canonical source before Tamil precision formatting', () => {
  expect(formatSourceForOutput('Ru', { outputScheme: 'sanskrit-tamil-precision' })).toBe(
    formatSourceForOutput('R^i', { outputScheme: 'sanskrit-tamil-precision' }),
  );
  expect(formatSourceForOutput('K', { outputScheme: 'sanskrit-tamil-precision' })).toBe(
    formatSourceForOutput('kh', { outputScheme: 'sanskrit-tamil-precision' }),
  );
  expect(formatSourceForOutput('ee', { outputScheme: 'sanskrit-tamil-precision' })).toBe(
    formatSourceForOutput('I', { outputScheme: 'sanskrit-tamil-precision' }),
  );
  expect(formatSourceForOutput('ou', { outputScheme: 'sanskrit-tamil-precision' })).toBe(
    formatSourceForOutput('au', { outputScheme: 'sanskrit-tamil-precision' }),
  );
});

test('Gate 2 routes primary copy formatting by script and style instead of legacy outputScheme', () => {
  const source = 'R^i kh OM kR^ita';

  expect(
    formatSourceForPrimaryOutput(source, {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'roman',
      romanOutputStyle: 'canonical',
    }),
  ).toBe('R^i kh OM kR^ita');
  expect(
    formatSourceForPrimaryOutput(source, {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'roman',
      romanOutputStyle: 'baraha',
    }),
  ).toBe('Ru K oum kRuta');
  expect(
    formatSourceForPrimaryOutput(source, {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'tamil',
    }),
  ).toBe('ரு¹ க²் ஓம் க்ரு¹த');
  expect(
    formatSourceForPrimaryOutput(source, {
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'devanagari',
      romanOutputStyle: 'baraha',
    }),
  ).toBe('ऋ ख् ॐ कृत');
});

test('Gate 2 keeps comparison state and inactive styles from changing the primary copy result', () => {
  const source = 'R^i kh OM';

  expect(
    formatSourceForPrimaryOutput(
      source,
      {
        ...DEFAULT_OUTPUT_TARGET_SETTINGS,
        primaryOutputScript: 'roman',
        comparisonOutputScript: 'tamil',
        romanOutputStyle: 'canonical',
        tamilOutputStyle: 'precision',
      },
    ),
  ).toBe('R^i kh OM');
  expect(
    formatSourceForPrimaryOutput(
      source,
      {
        ...DEFAULT_OUTPUT_TARGET_SETTINGS,
        primaryOutputScript: 'tamil',
        comparisonOutputScript: 'roman',
        romanOutputStyle: 'baraha',
        tamilOutputStyle: 'precision',
      },
    ),
  ).toBe('ரு¹ க²் ஓம்');
  expect(
    formatSourceForPrimaryOutput(
      source,
      {
        ...DEFAULT_OUTPUT_TARGET_SETTINGS,
        primaryOutputScript: 'devanagari',
        comparisonOutputScript: 'roman',
        romanOutputStyle: 'baraha',
      },
    ),
  ).toBe('ऋ ख् ॐ');
});

test('Gate 2 uses the same primary target descriptor for whole-document and composer copy affordances', () => {
  expect(
    getCopySourceControlText({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'roman',
      romanOutputStyle: 'baraha',
    }),
  ).toEqual({
    ariaLabel: 'Copy ITRANS source as Roman (Baraha)',
    title: 'Copy ITRANS as Roman (Baraha)',
    targetLabel: 'Roman (Baraha)',
  });
  expect(
    getCopySourceControlText({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'tamil',
    }),
  ).toEqual({
    ariaLabel: 'Copy ITRANS source as Tamil (Precision)',
    title: 'Copy ITRANS as Tamil (Precision)',
    targetLabel: 'Tamil (Precision)',
  });
  expect(
    getCopySourceControlText({
      ...DEFAULT_OUTPUT_TARGET_SETTINGS,
      primaryOutputScript: 'devanagari',
      romanOutputStyle: 'baraha',
    }),
  ).toEqual({
    ariaLabel: 'Copy ITRANS source as Devanagari',
    title: 'Copy ITRANS as Devanagari',
    targetLabel: 'Devanagari',
  });
});

test('Gate 2 rich goldens exercise every superscript family and direct Grantha mapping', () => {
  const richFormatted = TAMIL_PRECISION_RICH_GOLDENS.map(([, expected]) => expected).join(' ');
  const asciiFormatted = TAMIL_PRECISION_ASCII_FALLBACK_GOLDENS.map(([, expected]) => expected).join(' ');

  expect(richFormatted).toContain('²');
  expect(richFormatted).toContain('³');
  expect(richFormatted).toContain('⁴');
  expect(richFormatted).toContain('ஜ');
  expect(richFormatted).toContain('ஶ');
  expect(richFormatted).toContain('ஷ');
  expect(richFormatted).toContain('ஸ');
  expect(richFormatted).toContain('ஹ');
  expect(richFormatted).toContain('க்ஷ');
  expect(richFormatted).toContain('ஂ');
  expect(richFormatted).toContain('ஃ');
  expect(asciiFormatted).toContain('^2');
  expect(asciiFormatted).toContain('^3');
  expect(asciiFormatted).toContain('^4');
  expect(asciiFormatted).toContain('<R>');
  expect(asciiFormatted).toContain('<L>');
});

test('Gate 3 parses every frozen Tamil precision rich golden back to canonical Roman', () => {
  for (const [canonical, tamilPrecision] of TAMIL_PRECISION_RICH_GOLDENS) {
    expect(
      detransliterate(tamilPrecision, { outputScheme: 'sanskrit-tamil-precision' }),
      `${tamilPrecision} should parse back to ${canonical}`,
    ).toBe(canonical);
  }
});

test('Gate 3 parses ASCII-safe Tamil precision fallbacks back to canonical Roman', () => {
  for (const [canonical, tamilPrecision] of TAMIL_PRECISION_ASCII_FALLBACK_GOLDENS) {
    expect(
      detransliterate(tamilPrecision, { outputScheme: 'sanskrit-tamil-precision' }),
      `${tamilPrecision} should parse back to ${canonical}`,
    ).toBe(canonical);
  }
});

test('Gate 3 keeps ordinary Tamil ru and lu sequences separate from vocalic precision vowels', () => {
  expect(detransliterate('ரு', { outputScheme: 'sanskrit-tamil-precision' })).toBe('ரு');
  expect(detransliterate('ரூ', { outputScheme: 'sanskrit-tamil-precision' })).toBe('ரூ');
  expect(detransliterate('லு', { outputScheme: 'sanskrit-tamil-precision' })).toBe('லு');
  expect(detransliterate('லூ', { outputScheme: 'sanskrit-tamil-precision' })).toBe('லூ');
  expect(detransliterate('கவி', { outputScheme: 'sanskrit-tamil-precision' })).toBe('கவி');
  expect(detransliterate('குரு', { outputScheme: 'sanskrit-tamil-precision' })).toBe('குரு');
  expect(detransliterate('ரு', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('R^i');
  expect(detransliterate('ரூ', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('R^I');
  expect(detransliterate('லு', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('L^i');
  expect(detransliterate('லூ', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('L^I');
  expect(detransliterate('கவி', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('kavi');
  expect(detransliterate('குரு', { outputScheme: 'sanskrit-tamil-precision' })).not.toBe('kuru');
});

test('Gate 3 rejects incomplete or ambiguous precision marker fragments instead of guessing', () => {
  expect(detransliterate('க^', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க^');
  expect(detransliterate('க^^', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க^^');
  expect(detransliterate('க^1', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க^1');
  expect(detransliterate('க¹', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க¹');
  expect(detransliterate('ரு<R', { outputScheme: 'sanskrit-tamil-precision' })).toBe('ரு<R');
  expect(detransliterate('லு<L', { outputScheme: 'sanskrit-tamil-precision' })).toBe('லு<L');
  expect(detransliterate('க³ுரு ரு', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க³ுரு ரு');
  expect(detransliterate('க^3ுரு ரு<R', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க^3ுரு ரு<R');
});

test('Gate 3 does not over-parse representative ordinary Baraha Tamil example words as precision-safe Sanskrit', () => {
  expect(detransliterate('சென்று வருகிறேன்', { outputScheme: 'sanskrit-tamil-precision' })).toBe('சென்று வருகிறேன்');
  expect(detransliterate('மழை பெய்து கொண்டிருக்கிறது', { outputScheme: 'sanskrit-tamil-precision' })).toBe('மழை பெய்து கொண்டிருக்கிறது');
  expect(detransliterate('வாழ்த்துக்கள்', { outputScheme: 'sanskrit-tamil-precision' })).toBe('வாழ்த்துக்கள்');
});

test('Gate 4 round-trips canonical Roman through Tamil precision rich display', () => {
  for (const [canonical, expectedTamil] of TAMIL_PRECISION_RICH_GOLDENS) {
    const formatted = formatSourceForOutput(canonical, { outputScheme: 'sanskrit-tamil-precision' });
    const reversed = detransliterate(formatted, { outputScheme: 'sanskrit-tamil-precision' });

    expect(formatted, `${canonical} should still format to frozen rich golden ${expectedTamil}`).toBe(expectedTamil);
    expect(reversed, `${canonical} rich round-trip should return canonical Roman`).toBe(canonical);
  }
});

test('Gate 4 round-trips Tamil precision rich display back to the same frozen rich display', () => {
  for (const [canonical, expectedTamil] of TAMIL_PRECISION_RICH_GOLDENS) {
    const reversed = detransliterate(expectedTamil, { outputScheme: 'sanskrit-tamil-precision' });
    const reformatted = formatSourceForOutput(reversed, { outputScheme: 'sanskrit-tamil-precision' });

    expect(reversed, `${expectedTamil} should reverse to canonical Roman ${canonical}`).toBe(canonical);
    expect(reformatted, `${expectedTamil} should reformat to the same rich display`).toBe(expectedTamil);
  }
});

test('Gate 4 round-trips Tamil precision ASCII fallback back to frozen rich display', () => {
  for (const [canonical, asciiTamil] of TAMIL_PRECISION_ASCII_FALLBACK_GOLDENS) {
    const reversed = detransliterate(asciiTamil, { outputScheme: 'sanskrit-tamil-precision' });
    const richReformatted = formatSourceForOutput(reversed, { outputScheme: 'sanskrit-tamil-precision' });
    const expectedRich = TAMIL_PRECISION_RICH_GOLDENS.find(([entryCanonical]) => entryCanonical === canonical)?.[1];

    expect(expectedRich, `Missing corresponding rich golden for ${canonical}`).toBeDefined();
    expect(reversed, `${asciiTamil} should reverse to canonical Roman ${canonical}`).toBe(canonical);
    expect(richReformatted, `${asciiTamil} should normalize back to frozen rich display`).toBe(expectedRich);
  }
});

test('Gate 4 round-trips Devanagari through canonical Roman and Tamil precision back to canonical Roman', () => {
  for (const [devanagari, canonical] of TAMIL_PRECISION_GATE4_DEVANAGARI_FIXTURES) {
    const reverseFromDevanagari = detransliterate(devanagari);
    const tamilPrecision = formatSourceForOutput(reverseFromDevanagari, { outputScheme: 'sanskrit-tamil-precision' });
    const roundTripCanonical = detransliterate(tamilPrecision, { outputScheme: 'sanskrit-tamil-precision' });

    expect(roundTripCanonical, `${canonical} should survive Devanagari -> Tamil precision -> canonical Roman`).toBe(canonical);
  }
});

test('Gate 4 mixed fixtures exercise atomic, cluster, vocalic, anusvara, and visarga paths against fixed expected outputs', () => {
  const mixedRich = TAMIL_PRECISION_GATE4_MIXED_FIXTURES.map(([, expectedTamil]) => expectedTamil).join(' ');

  for (const [canonical, expectedTamil] of TAMIL_PRECISION_GATE4_MIXED_FIXTURES) {
    expect(
      formatSourceForOutput(canonical, { outputScheme: 'sanskrit-tamil-precision' }),
      `${canonical} should match fixed mixed-fixture Tamil output`,
    ).toBe(expectedTamil);
    expect(
      detransliterate(expectedTamil, { outputScheme: 'sanskrit-tamil-precision' }),
      `${expectedTamil} should reverse to canonical ${canonical}`,
    ).toBe(canonical);
  }

  expect(mixedRich).toContain('²');
  expect(mixedRich).toContain('³');
  expect(mixedRich).toContain('⁴');
  expect(mixedRich).toContain('க்ஷ');
  expect(mixedRich).toContain('ஂ');
  expect(mixedRich).toContain('ஃ');
  expect(mixedRich).toContain('ரு¹');
  expect(mixedRich).toContain('லு¹');
});

test('Gate 5 keeps output scheme labels and meanings explicit after adding Tamil precision', () => {
  expect(OUTPUT_SCHEME_LABELS).toEqual({
    'canonical-vedic': 'Canonical Vedic',
    'baraha-compatible': 'Baraha-compatible',
    'sanskrit-tamil-precision': 'Tamil Precision',
  });
  expect(OUTPUT_SCHEME_UI_METADATA).toEqual({
    'canonical-vedic': {
      buttonTitle: 'Canonical Vedic Output',
      buttonDescription: 'Copies canonical source such as `R^i`, `kh`, `ch`, and `.a`.',
    },
    'baraha-compatible': {
      buttonTitle: 'Baraha-Compatible Output',
      buttonDescription: 'Copies compatible source such as `Ru`, `K`, `c`, `oum`, and `&` without changing internal storage.',
    },
    'sanskrit-tamil-precision': {
      buttonTitle: 'Tamil Precision Output',
      buttonDescription: 'Copies Sanskrit-in-Tamil precision forms such as `க³ீதா`, `அம்ரு¹த`, and `க³ுருஃ` without changing stored source.',
    },
  });
});

test('Gate 5 keeps existing canonical and Baraha output behavior unchanged alongside Tamil precision', () => {
  const canonicalSource = 'R^i kh ch Ch OM .a ~N ~n kR^ita';

  expect(formatSourceForOutput(canonicalSource, { outputScheme: 'canonical-vedic' })).toBe(
    'R^i kh ch Ch OM .a ~N ~n kR^ita',
  );
  expect(formatSourceForOutput(canonicalSource, { outputScheme: 'baraha-compatible' })).toBe(
    'Ru K c C oum & ~g ~j kRuta',
  );
  expect(formatSourceForOutput('R^i', { outputScheme: 'sanskrit-tamil-precision' })).toBe('ரு¹');
  expect(formatSourceForOutput('kh', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க²்');
  expect(formatSourceForOutput('Ch', { outputScheme: 'sanskrit-tamil-precision' })).toBe('ச²்');
  expect(formatSourceForOutput('kR^ita', { outputScheme: 'sanskrit-tamil-precision' })).toBe('க்ரு¹த');
});

test('Gate 5 keeps paste canonicalization canonical while Tamil precision remains output-only', () => {
  expect(canonicalizeDevanagariPaste('कृत')).toBe('kR^ita');
  expect(canonicalizeDevanagariPaste('ॐ')).toBe('OM');
  expect(detransliterate('க³ீதா', { outputScheme: 'sanskrit-tamil-precision' })).toBe('gItA');
  expect(canonicalizeAcceptedInputToken(detransliterate('க³ீதா', { outputScheme: 'sanskrit-tamil-precision' }))).toBe('gItA');
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
