import path from 'node:path';

export type CanonicalInputMode = 'from_devanagari' | 'from_itrans';

export interface CanonicalRecordConfig {
  mode: CanonicalInputMode;
  idField?: string;
  devanagariField?: string;
  itransField?: string;
  romanField?: string;
  sourceField?: string;
  scoreField?: string;
  normalizeForLexicon?: boolean;
}

export interface SwaraRecordConfig {
  textField: string;
}

export interface NdjsonRecordDataset {
  id: string;
  label: string;
  format: 'ndjson-records';
  path: string;
  canonical?: CanonicalRecordConfig;
  swara?: SwaraRecordConfig;
}

export interface DevanagariTextDataset {
  id: string;
  label: string;
  format: 'devanagari-text';
  path: string;
  canonical?: CanonicalRecordConfig;
  swara: {
    enabled: true;
  };
}

export type CorpusDataset = NdjsonRecordDataset | DevanagariTextDataset;

export interface CorpusPreset {
  id: string;
  canonicalDatasets: string[];
  swaraDatasets: string[];
}

export interface CanonicalExtraction {
  id: string;
  devanagari: string;
  itrans: string;
  originalRoman: string;
  source: string | null;
  score: number | null;
  normalizeForLexicon: boolean;
}

const APP_ROOT = process.cwd();
const WORKSPACE_ROOT = path.resolve(APP_ROOT, '..');

export const CORPUS_DATASETS: Record<string, CorpusDataset> = {
  'san-train': {
    id: 'san-train',
    label: 'Sanskrit train set',
    format: 'ndjson-records',
    path: path.resolve(WORKSPACE_ROOT, 'data_corpus/san/san_train.json'),
    canonical: {
      mode: 'from_devanagari',
      idField: 'unique_identifier',
      devanagariField: 'native word',
      romanField: 'english word',
      sourceField: 'source',
      scoreField: 'score',
    },
  },
  'san-valid': {
    id: 'san-valid',
    label: 'Sanskrit validation set',
    format: 'ndjson-records',
    path: path.resolve(WORKSPACE_ROOT, 'data_corpus/san/san_valid.json'),
    canonical: {
      mode: 'from_devanagari',
      idField: 'unique_identifier',
      devanagariField: 'native word',
      romanField: 'english word',
      sourceField: 'source',
      scoreField: 'score',
    },
  },
  'san-test': {
    id: 'san-test',
    label: 'Sanskrit test set',
    format: 'ndjson-records',
    path: path.resolve(WORKSPACE_ROOT, 'data_corpus/san/san_test.json'),
    canonical: {
      mode: 'from_devanagari',
      idField: 'unique_identifier',
      devanagariField: 'native word',
      romanField: 'english word',
      sourceField: 'source',
      scoreField: 'score',
    },
  },
  'example-vedic': {
    id: 'example-vedic',
    label: 'Archived Vedic example corpus',
    format: 'devanagari-text',
    path: path.resolve(WORKSPACE_ROOT, 'archive/example.txt'),
    canonical: {
      mode: 'from_devanagari',
      devanagariField: 'token',
      sourceField: 'source',
      normalizeForLexicon: true,
    },
    swara: {
      enabled: true,
    },
  },
};

export const CORPUS_PRESETS: Record<string, CorpusPreset> = {
  'sanskrit-default': {
    id: 'sanskrit-default',
    canonicalDatasets: ['san-train', 'example-vedic'],
    swaraDatasets: ['example-vedic'],
  },
  'sanskrit-all-splits': {
    id: 'sanskrit-all-splits',
    canonicalDatasets: ['san-train', 'san-valid', 'san-test', 'example-vedic'],
    swaraDatasets: ['example-vedic'],
  },
};

const readField = (row: Record<string, unknown>, key: string | undefined) => {
  if (!key) {
    return undefined;
  }

  return row[key];
};

export const parseDatasetIds = (value: string | undefined) =>
  value
    ?.split(',')
    .map((id) => id.trim())
    .filter(Boolean) ?? [];

export const resolveCorpusDataset = (id: string): CorpusDataset => {
  const dataset = CORPUS_DATASETS[id];
  if (!dataset) {
    throw new Error(
      `Unknown corpus dataset "${id}". Known datasets: ${Object.keys(CORPUS_DATASETS).join(', ')}`
    );
  }

  return dataset;
};

export const resolveCorpusDatasets = (ids: string[]) => ids.map(resolveCorpusDataset);

export const resolveCorpusPreset = (id: string): CorpusPreset => {
  const preset = CORPUS_PRESETS[id];
  if (!preset) {
    throw new Error(
      `Unknown corpus preset "${id}". Known presets: ${Object.keys(CORPUS_PRESETS).join(', ')}`
    );
  }

  return preset;
};

export const extractCanonicalRow = (
  config: CanonicalRecordConfig,
  row: Record<string, unknown>,
  fallbackId: string,
  datasetId?: string
): CanonicalExtraction | null => {
  const rawSource = readField(row, config.sourceField);
  const rawScore = readField(row, config.scoreField);
  const rawId = readField(row, config.idField);
  const roman = String(readField(row, config.romanField) ?? '').trim();

  if (config.mode === 'from_devanagari') {
    const devanagari = String(readField(row, config.devanagariField) ?? '').trim();
    if (!devanagari) {
      return null;
    }

    return {
      id: String(rawId ?? fallbackId),
      devanagari,
      itrans: '',
      originalRoman: roman,
      source: typeof rawSource === 'string' ? rawSource : datasetId ?? null,
      score: typeof rawScore === 'number' ? rawScore : null,
      normalizeForLexicon: Boolean(config.normalizeForLexicon),
    };
  }

  const itrans = String(readField(row, config.itransField) ?? '').trim();
  if (!itrans) {
    return null;
  }

  const devanagari = String(readField(row, config.devanagariField) ?? '').trim();
  return {
    id: String(rawId ?? fallbackId),
    devanagari,
    itrans,
    originalRoman: roman,
    source: typeof rawSource === 'string' ? rawSource : datasetId ?? null,
    score: typeof rawScore === 'number' ? rawScore : null,
    normalizeForLexicon: Boolean(config.normalizeForLexicon),
  };
};

export const extractSwaraRecordText = (
  dataset: CorpusDataset,
  row: Record<string, unknown>
) => {
  if (dataset.format !== 'ndjson-records' || !dataset.swara) {
    return null;
  }

  const value = row[dataset.swara.textField];
  return typeof value === 'string' ? value.trim() : null;
};
