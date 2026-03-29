import { expect, test } from '@playwright/test';

import {
  CORPUS_DATASETS,
  extractCanonicalRow,
  extractSwaraRecordText,
  resolveCorpusPreset,
} from './test-support/corpusRegistry';
import {
  sanitizeDevanagariCorpusToken,
  stripDevanagariLexicalMarks,
  tokenizeDevanagariText,
} from './test-support/corpusText';
import {
  canonicalizeLexicalItrans,
  normalizeForCanonicalValidation,
  normalizeForCanonicalLexiconTraining,
  normalizeForLexicalLookup,
} from './src/lib/vedic/lexicalNormalization';
import { detransliterate, transliterate } from './src/lib/vedic/utils';
import { processCanonicalRow } from './scripts/buildCanonicalLexiconShared';

test.describe('corpus pipeline registry', () => {
  test('default preset uses san-train plus example corpus for lexical data and example corpus for swara data', () => {
    const preset = resolveCorpusPreset('sanskrit-default');

    expect(preset.canonicalDatasets).toEqual(['san-train', 'example-vedic']);
    expect(preset.swaraDatasets).toEqual(['example-vedic']);
  });

  test('extracts canonical rows from san-train records using dataset metadata', () => {
    const dataset = CORPUS_DATASETS['san-train'];
    expect(dataset.format).toBe('ndjson-records');
    if (dataset.format !== 'ndjson-records' || !dataset.canonical) {
      throw new Error('san-train must be a canonical ndjson dataset');
    }

    const extracted = extractCanonicalRow(
      dataset.canonical,
      {
        unique_identifier: 'san1',
        'native word': 'भक्षयिष्यन्ति',
        'english word': 'bhakshayishyanti',
        source: 'AK-Freq',
        score: null,
      },
      'fallback-id',
      dataset.id
    );

    expect(extracted).toEqual({
      id: 'san1',
      devanagari: 'भक्षयिष्यन्ति',
      itrans: '',
      originalRoman: 'bhakshayishyanti',
      source: 'AK-Freq',
      score: null,
      normalizeForLexicon: false,
    });
  });

  test('extracts canonical rows from example-vedic tokens and normalizes away swara markers', () => {
    const dataset = CORPUS_DATASETS['example-vedic'];
    expect(dataset.format).toBe('devanagari-text');
    if (dataset.format !== 'devanagari-text' || !dataset.canonical) {
      throw new Error('example-vedic must be a canonical text dataset');
    }

    const token = tokenizeDevanagariText('भ॒द्रं कर्णे॑भिः')[0];
    const extracted = extractCanonicalRow(
      dataset.canonical,
      { token, source: dataset.id },
      'example-1',
      dataset.id
    );

    expect(extracted).toEqual({
      id: 'example-1',
      devanagari: 'भ॒द्रं',
      itrans: '',
      originalRoman: '',
      source: 'example-vedic',
      score: null,
      normalizeForLexicon: true,
    });

    const canonicalItrans = normalizeForLexicalLookup(detransliterate(extracted!.devanagari));
    expect(canonicalItrans).toBe('bhadraM');
    expect(transliterate(canonicalItrans).unicode).toBe(stripDevanagariLexicalMarks(extracted!.devanagari));
  });

  test('extracts swara training text from record datasets when configured', () => {
    const baseDataset = CORPUS_DATASETS['san-train'];
    if (baseDataset.format !== 'ndjson-records') {
      throw new Error('san-train must be a record dataset');
    }

    const dataset = {
      ...baseDataset,
      swara: { textField: 'native word' },
    };

    const text = extractSwaraRecordText(dataset, {
      'native word': 'भ॒द्रं कर्णे॑भिः',
    });

    expect(text).toBe('भ॒द्रं कर्णे॑भिः');
  });

  test('sanitizes corpus tokens by trimming punctuation and rejecting unsupported private-use marks', () => {
    expect(sanitizeDevanagariCorpusToken('।सुप्रजा')).toBe('सुप्रजा');
    expect(sanitizeDevanagariCorpusToken('शुक्रपा')).toBeNull();
    expect(sanitizeDevanagariCorpusToken('ग')).toBe('ग');
  });

  test('canonicalizes vocalic r and l aliases for lexical training', () => {
    expect(canonicalizeLexicalItrans('tR^itiiya')).toBe('tRRitiiya');
    expect(canonicalizeLexicalItrans('kL^ipta')).toBe('kLLipta');
    expect(normalizeForLexicalLookup('tR^itiiya')).toBe('tRRitiiya');
    expect(normalizeForCanonicalValidation('kL^iptyai')).toBe('kL^iptyai');
    expect(normalizeForCanonicalLexiconTraining('puNyaM~')).toBe('puNya');
    expect(normalizeForCanonicalLexiconTraining('naaraashaM~syarchaa.abhiSi~nchati')).toBe(
      'naaraashasyarchaa.abhiSi~nchati'
    );
  });

  test('validates example-vedic rows with raw reverse itrans before lexical normalization', () => {
    const dataset = CORPUS_DATASETS['example-vedic'];
    expect(dataset.format).toBe('devanagari-text');
    if (dataset.format !== 'devanagari-text' || !dataset.canonical) {
      throw new Error('example-vedic must be a canonical text dataset');
    }

    const record = processCanonicalRow({
      row: { token: 'कॢप्त्यै', source: dataset.id },
      config: dataset.canonical,
      rowId: 'example-kL-1',
      datasetId: dataset.id,
    });

    expect(record).toEqual({
      id: 'example-kL-1',
      devanagari: 'कॢप्त्यै',
      itrans: 'kLLiptyai',
      originalRoman: '',
      source: 'example-vedic',
      score: null,
      forwardUnicode: 'कॢप्त्यै',
      forwardStatus: 'exact_pass',
    });
  });

  test('treats swara-marked example-vedic rows as exact passes after stripped comparison', () => {
    const dataset = CORPUS_DATASETS['example-vedic'];
    expect(dataset.format).toBe('devanagari-text');
    if (dataset.format !== 'devanagari-text' || !dataset.canonical) {
      throw new Error('example-vedic must be a canonical text dataset');
    }

    const record = processCanonicalRow({
      row: { token: 'भ॒द्रं', source: dataset.id },
      config: dataset.canonical,
      rowId: 'example-swara-1',
      datasetId: dataset.id,
    });

    expect(record).toEqual({
      id: 'example-swara-1',
      devanagari: 'भद्रं',
      itrans: 'bhadraM',
      originalRoman: '',
      source: 'example-vedic',
      score: null,
      forwardUnicode: 'भद्रं',
      forwardStatus: 'exact_pass',
    });
  });

  test('drops non-lexical M~ markers during canonical corpus training', () => {
    expect(normalizeForCanonicalValidation('puNyaM~')).toBe('puNya');
    expect(normalizeForCanonicalLexiconTraining('puNyaM~')).toBe('puNya');
    expect(normalizeForCanonicalValidation('naaraashaM~syarchaa.abhiSi~nchati')).toBe(
      'naaraashasyarchaa.abhiSi~nchati'
    );
  });
});
