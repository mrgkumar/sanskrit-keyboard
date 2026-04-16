import { join } from 'node:path';
import { SOURCE_INVENTORY } from './sourceInventory.ts';
import type { BatchRequest, TemplateFamily } from './types.ts';
import { hashObject } from './utils.ts';
import { ensureDir, writeJson } from './loaders.ts';

export interface CorpusManifest {
  schemaVersion: 1;
  mode: 'stream' | 'record' | 'replay';
  generation: {
    length: number;
    batchSize: number;
    workers: number;
    ordered: boolean;
    seed: number;
    templates: TemplateFamily[];
    includeExtendedConsonants: boolean;
    includeVedic: boolean;
    includeGeneralCombiningMarks: boolean;
  };
  sourceInventoryHash: string;
  totalEmittedBatches?: number;
  replayFiles?: string[];
}

export const buildManifest = (
  mode: CorpusManifest['mode'],
  request: BatchRequest,
  config: {
    workers: number;
    ordered: boolean;
    seed: number;
    includeExtendedConsonants: boolean;
    includeVedic: boolean;
    includeGeneralCombiningMarks: boolean;
  },
  totalEmittedBatches?: number,
  replayFiles?: string[]
): CorpusManifest => ({
  schemaVersion: 1,
  mode,
  generation: {
    length: request.length,
    batchSize: request.batchSize,
    workers: config.workers,
    ordered: config.ordered,
    seed: config.seed,
    templates: request.templates ?? [],
    includeExtendedConsonants: config.includeExtendedConsonants,
    includeVedic: config.includeVedic,
    includeGeneralCombiningMarks: config.includeGeneralCombiningMarks,
  },
  sourceInventoryHash: hashObject(SOURCE_INVENTORY),
  totalEmittedBatches,
  replayFiles,
});

export const writeManifest = (recordDir: string, manifest: CorpusManifest) => {
  ensureDir(recordDir);
  writeJson(join(recordDir, 'manifest.json'), manifest);
};
