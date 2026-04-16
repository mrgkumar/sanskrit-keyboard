export type InventoryCategory =
  | 'baseConsonant'
  | 'extendedConsonant'
  | 'independentVowel'
  | 'dependentVowelSign'
  | 'virama'
  | 'nukta'
  | 'binduSign'
  | 'vedicSign'
  | 'combiningMarkGeneral'
  | 'punctuation'
  | 'symbol'
  | 'privateUseOrFontSpecific'
  | 'excluded';

export type TemplateFamily = 'plain' | 'virama' | 'matra' | 'ending' | 'vedic';

export interface SourceRange {
  start: number;
  end: number;
  label: string;
}

export interface SourceInventory {
  baseConsonants: string[];
  extendedConsonants: string[];
  independentVowels: string[];
  dependentVowelSigns: string[];
  virama: string[];
  nukta: string[];
  binduSigns: string[];
  vedicSigns: string[];
  vedicRanges: SourceRange[];
  combiningMarkRanges: SourceRange[];
  punctuation: string[];
  symbols: string[];
  privateUseSamples: string[];
}

export interface InventorySourceItem {
  group: keyof SourceInventory;
  index: number;
  text: string;
  codePoints: number[];
  isRange: boolean;
  rangeLabel?: string;
}

export interface ClassifiedCodePoint {
  codePoint: number;
  char: string;
  hex: string;
  category: InventoryCategory;
  sourceGroups: string[];
  sourceCount: number;
  notes: string[];
}

export interface ClassificationReport {
  classification: ClassifiedCodePoint[];
  countsByCategory: Record<InventoryCategory, number>;
  includedConsonants: string[];
  excludedConsonants: string[];
  unknownCodePoints: string[];
  duplicates: string[];
  privateUseCodePoints: string[];
  nonDevanagariCombiningMarks: string[];
}

export interface BatchRequest {
  length: number;
  batchSize: number;
  templates?: TemplateFamily[];
  includeVedic?: boolean;
  includeExtendedConsonants?: boolean;
  includeGeneralCombiningMarks?: boolean;
  includeSymbols?: boolean;
  ordered?: boolean;
  seed?: number;
}

export interface CorpusEntry {
  id: string;
  codePointLength: number;
  text: string;
  normalizedNFC: string;
  normalizedNFD: string;
  codePointsHex: string[];
  templateId: string;
  categoriesUsed: string[];
  hasVirama: boolean;
  hasMatra: boolean;
  hasIndependentVowel: boolean;
  hasNukta: boolean;
  hasBindu: boolean;
  hasVedicMark: boolean;
  hasExtendedConsonant: boolean;
  notes: string[];
}

export interface BatchResult {
  batchId: string;
  items: CorpusEntry[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface ProducerConfig {
  workers?: number;
  queueHighWaterMark?: number;
  mode?: 'stream' | 'record' | 'replay';
  recordDir?: string;
  replayDir?: string;
  ordered?: boolean;
  seed?: number;
  includeExtendedConsonants?: boolean;
  includeVedic?: boolean;
  includeGeneralCombiningMarks?: boolean;
  templates?: TemplateFamily[];
}

export interface BatchCursor {
  partitionId: string;
  entryIndex: number;
  batchIndex: number;
}

export interface GeneratedBatch {
  partitionId: string;
  partitionOrdinal: number;
  batchIndex: number;
  batchId: string;
  templateId: string;
  items: CorpusEntry[];
  hasMore: boolean;
  nextCursor?: BatchCursor;
}

export interface WorkerBatchItem {
  text: string;
}

export interface WorkerGeneratedBatch {
  partitionId: string;
  partitionOrdinal: number;
  batchIndex: number;
  batchId: string;
  templateId: string;
  items: WorkerBatchItem[];
  hasMore: boolean;
  nextCursor?: BatchCursor;
}

export interface GenerationContext {
  length: number;
  batchSize: number;
  templates: TemplateFamily[];
  includeVedic: boolean;
  includeExtendedConsonants: boolean;
  includeGeneralCombiningMarks: boolean;
  includeSymbols: boolean;
  ordered: boolean;
  seed: number;
}

export interface CorpusProducer {
  getNextBatch(request: BatchRequest): Promise<BatchResult>;
  iterateBatches(request: BatchRequest): AsyncGenerator<BatchResult>;
  iterateEntries(request: BatchRequest): AsyncGenerator<CorpusEntry>;
  reset(seed?: number): void;
  pause(): void;
  resume(): void;
  close(): Promise<void>;
}
