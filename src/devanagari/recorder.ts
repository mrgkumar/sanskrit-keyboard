import { join } from 'node:path';
import type { BatchResult } from './types.ts';
import { ensureDir, writeJsonLine } from './loaders.ts';
import type { CorpusManifest } from './manifest.ts';
import { writeManifest } from './manifest.ts';

export interface RecordedBatchFile {
  fileName: string;
  batchId: string;
}

export class CorpusRecorder {
  private readonly recordingsDir: string;
  private readonly files: RecordedBatchFile[] = [];
  private emittedBatches = 0;
  private readonly recordDir: string;
  private readonly manifestFactory: (totalEmittedBatches?: number, replayFiles?: string[]) => CorpusManifest;

  constructor(
    recordDir: string,
    manifestFactory: (totalEmittedBatches?: number, replayFiles?: string[]) => CorpusManifest
  ) {
    this.recordDir = recordDir;
    this.manifestFactory = manifestFactory;
    this.recordingsDir = join(recordDir, 'recordings');
    ensureDir(this.recordingsDir);
  }

  recordBatch(batch: BatchResult) {
    this.emittedBatches++;
    const fileName = `batch_${this.emittedBatches.toString().padStart(6, '0')}.jsonl`;
    const fullPath = join(this.recordingsDir, fileName);
    writeJsonLine(fullPath, {
      schemaVersion: 1,
      batch,
    });
    this.files.push({ fileName, batchId: batch.batchId });
  }

  close() {
    const manifest = this.manifestFactory(this.emittedBatches, this.files.map((file) => `recordings/${file.fileName}`));
    writeManifest(this.recordDir, manifest);
  }
}
