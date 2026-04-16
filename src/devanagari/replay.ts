import { join } from 'node:path';
import { readJson, readText } from './loaders.ts';
import type { BatchResult } from './types.ts';
import type { CorpusManifest } from './manifest.ts';

interface ReplayFilePayload {
  schemaVersion: 1;
  batch: BatchResult;
}

export class CorpusReplay {
  private readonly batches: BatchResult[];
  private cursor = 0;
  readonly manifest: CorpusManifest;

  constructor(private readonly replayDir: string) {
    this.manifest = readJson<CorpusManifest>(join(replayDir, 'manifest.json'));
    const files = this.manifest.replayFiles ?? [];
    this.batches = files.map((file) => {
      const payload = JSON.parse(readText(join(replayDir, file))) as ReplayFilePayload;
      return payload.batch;
    });
  }

  nextBatch(): BatchResult | null {
    if (this.cursor >= this.batches.length) {
      return null;
    }
    const batch = this.batches[this.cursor++];
    return batch;
  }

  reset() {
    this.cursor = 0;
  }
}
