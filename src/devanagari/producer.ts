import { join } from 'node:path';
import { classifyInventory } from './classify.ts';
import { buildCuratedInventories } from './curatedInventories.ts';
import { CorpusOrchestrator } from './orchestrator.ts';
import { CorpusRecorder } from './recorder.ts';
import { CorpusReplay } from './replay.ts';
import { buildManifest } from './manifest.ts';
import type {
  BatchRequest,
  BatchResult,
  CorpusProducer,
  ProducerConfig,
} from './types.ts';
import { resolveTemplateFamilies } from './templates.ts';
import { encodeCursor, hashObject } from './utils.ts';

const mergeRequest = (config: ProducerConfig, request: BatchRequest) => {
  const seed = request.seed ?? config.seed ?? 1;
  const ordered = request.ordered ?? config.ordered ?? true;
  const includeVedic = request.includeVedic ?? config.includeVedic ?? false;
  const includeExtendedConsonants = request.includeExtendedConsonants ?? config.includeExtendedConsonants ?? false;
  const includeGeneralCombiningMarks =
    request.includeGeneralCombiningMarks ?? config.includeGeneralCombiningMarks ?? false;
  const includeSymbols = request.includeSymbols ?? config.includeSymbols ?? false;
  const templates = resolveTemplateFamilies(request.templates ?? config.templates, includeVedic);

  return {
    length: request.length,
    batchSize: request.batchSize,
    seed,
    ordered,
    includeVedic,
    includeExtendedConsonants,
    includeGeneralCombiningMarks,
    includeSymbols,
    templates,
  };
};

class StreamProducerSession {
  private readonly report = classifyInventory();
  private orchestrator: CorpusOrchestrator | null = null;
  private recorder: CorpusRecorder | null = null;
  private replay: CorpusReplay | null = null;
  private activeRequestKey = '';
  private readonly config: ProducerConfig;

  constructor(config: ProducerConfig) {
    this.config = config;
  }

  private resolveRecordDir() {
    return this.config.recordDir ?? join(process.cwd(), 'output');
  }

  private resolveReplayDir() {
    return this.config.replayDir ?? join(process.cwd(), 'output');
  }

  private ensureOrchestrator(request: ReturnType<typeof mergeRequest>) {
    const requestKey = hashObject(request);
    if (this.activeRequestKey === requestKey && this.orchestrator) {
      return;
    }

    void this.close();
    this.activeRequestKey = requestKey;
    const inventories = buildCuratedInventories(this.report, request);
    this.orchestrator = new CorpusOrchestrator(
      {
        length: request.length,
        batchSize: request.batchSize,
        templates: request.templates,
        includeVedic: request.includeVedic,
        includeExtendedConsonants: request.includeExtendedConsonants,
        includeGeneralCombiningMarks: request.includeGeneralCombiningMarks,
        includeSymbols: request.includeSymbols,
        ordered: request.ordered,
        seed: request.seed,
      },
      inventories,
      this.config.queueHighWaterMark ?? 16,
      this.config.workers ?? 1
    );

    if (this.config.mode === 'record') {
      this.recorder = new CorpusRecorder(this.resolveRecordDir(), (totalEmittedBatches, replayFiles) =>
        buildManifest('record', request, {
          workers: this.config.workers ?? 1,
          ordered: request.ordered,
          seed: request.seed,
          includeExtendedConsonants: request.includeExtendedConsonants,
          includeVedic: request.includeVedic,
          includeGeneralCombiningMarks: request.includeGeneralCombiningMarks,
          includeSymbols: request.includeSymbols,
        }, totalEmittedBatches, replayFiles)
      );
    }
  }

  private ensureReplay() {
    if (this.replay) {
      return;
    }
    this.replay = new CorpusReplay(this.resolveReplayDir());
  }

  async getNextBatch(request: BatchRequest): Promise<BatchResult> {
    const resolved = mergeRequest(this.config, request);
    if (this.config.mode === 'replay') {
      this.ensureReplay();
      const batch = this.replay!.nextBatch();
      if (!batch) {
        return { batchId: 'replay-end', items: [], hasMore: false };
      }
      return batch;
    }

    this.ensureOrchestrator(resolved);
    const batch = await this.orchestrator!.nextBatch();
    if (!batch) {
      return { batchId: 'stream-end', items: [], hasMore: false };
    }

    const publicBatch: BatchResult = {
      batchId: batch.batchId,
      items: batch.items,
      hasMore: batch.hasMore,
      nextCursor: batch.nextCursor ? encodeCursor(batch.nextCursor) : undefined,
    };

    this.recorder?.recordBatch(publicBatch);
    return publicBatch;
  }

  async close() {
    await this.orchestrator?.close();
    this.recorder?.close();
    this.replay = null;
  }

  pause() {
    this.orchestrator?.pause();
  }

  resume() {
    this.orchestrator?.resume();
  }

  reset(seed?: number) {
    const nextSeed = seed ?? this.config.seed;
    this.config.seed = nextSeed;
    void this.close();
    this.orchestrator = null;
    this.recorder = null;
    if (this.replay) {
      this.replay.reset();
    }
    this.activeRequestKey = '';
  }
}

export const createCorpusProducer = (config: ProducerConfig = {}): CorpusProducer => {
  const session = new StreamProducerSession(config);
  return {
    getNextBatch: (request) => session.getNextBatch(request),
    async *iterateBatches(request) {
      while (true) {
        const batch = await session.getNextBatch(request);
        yield batch;
        if (!batch.hasMore) {
          break;
        }
      }
    },
    async *iterateEntries(request) {
      for await (const batch of this.iterateBatches(request)) {
        for (const entry of batch.items) {
          yield entry;
        }
      }
    },
    reset: (seed?: number) => session.reset(seed),
    pause: () => session.pause(),
    resume: () => session.resume(),
    close: () => session.close(),
  };
};
