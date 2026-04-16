import { Worker } from 'node:worker_threads';
import { join } from 'node:path';
import { BoundedAsyncQueue } from './queue.ts';
import type { CuratedInventories } from './curatedInventories.ts';
import { buildPartitions, type PartitionDescriptor } from './partition.ts';
import type { BatchCursor, BatchRequest, GenerationContext, GeneratedBatch } from './types.ts';
import { generatePartitionBatch } from './generator.ts';

interface SessionJob {
  partition: PartitionDescriptor;
  cursor: BatchCursor;
}

interface WorkerState {
  worker?: Worker;
  busy: boolean;
}

export class CorpusOrchestrator {
  private readonly queue: BoundedAsyncQueue<GeneratedBatch>;
  private readonly workers: WorkerState[] = [];
  private readonly partitionsById = new Map<string, PartitionDescriptor>();
  private readonly pendingJobs: SessionJob[] = [];
  private readonly orderedBuffer = new Map<string, GeneratedBatch>();
  private readonly workerScriptPath = join(process.cwd(), 'src', 'devanagari', 'worker.ts');
  private currentPartitionOrdinal = 0;
  private currentBatchIndex = 0;
  private readonly workerCount: number;
  private readonly useWorkers: boolean;
  private dispatchPromise: Promise<void> | null = null;
  private dispatchAgain = false;
  private paused = false;
  private closed = false;
  private fatalError: Error | null = null;
  private activeJobs = 0;

  constructor(
    private readonly context: GenerationContext,
    private readonly inventories: CuratedInventories,
    queueHighWaterMark: number,
    workerCount: number
  ) {
    this.queue = new BoundedAsyncQueue<GeneratedBatch>(queueHighWaterMark);
    this.workerCount = Math.max(1, workerCount);
    this.useWorkers = this.workerCount > 1;

    const partitions = buildPartitions(context, inventories);
    partitions.forEach((partition) => {
      this.partitionsById.set(partition.id, partition);
      this.pendingJobs.push({
        partition,
        cursor: { partitionId: partition.id, entryIndex: 0, batchIndex: 0 },
      });
    });

    if (this.useWorkers) {
      for (let index = 0; index < this.workerCount; index++) {
        const worker = new Worker(this.workerScriptPath, {
          execArgv: ['--experimental-strip-types'],
          workerData: { context, inventories },
        });
        const state: WorkerState = { worker, busy: false };
        this.workers.push(state);
        worker.on('message', (message) => {
          void this.handleWorkerMessage(state, message as GeneratedBatch | { error: string });
        });
        worker.on('error', (error) => {
          this.fail(error instanceof Error ? error : new Error(String(error)));
        });
      }
    }

  }

  private get nextJob(): SessionJob | null {
    return this.pendingJobs.shift() ?? null;
  }

  private requestDispatch() {
    if (this.dispatchPromise) {
      this.dispatchAgain = true;
      return;
    }

    this.dispatchPromise = this.runDispatch().finally(() => {
      this.dispatchPromise = null;
      if (this.dispatchAgain) {
        this.dispatchAgain = false;
        this.requestDispatch();
      }
    });
  }

  private async runDispatch() {
    if (this.closed || this.paused || this.fatalError) {
      return;
    }

    if (!this.useWorkers) {
      while (!this.closed && !this.paused && this.pendingJobs.length > 0) {
        const job = this.nextJob;
        if (!job) {
          break;
        }
        const result = generatePartitionBatch(job.partition, job.cursor, this.makeRequest(), this.context, this.inventories);
        await this.handleGeneratedResult(result);
      }
      return;
    }

    for (const state of this.workers) {
      if (this.closed || this.paused || this.fatalError) {
        return;
      }
      if (state.busy) {
        continue;
      }
      const job = this.nextJob;
      if (!job) {
        break;
      }
      state.busy = true;
      this.activeJobs++;
      state.worker!.postMessage({
        request: this.makeRequest(),
        partition: job.partition,
        cursor: job.cursor,
      });
    }
  }

  private makeRequest(): BatchRequest {
    return {
      length: this.context.length,
      batchSize: this.context.batchSize,
      templates: this.context.templates,
      includeVedic: this.context.includeVedic,
      includeExtendedConsonants: this.context.includeExtendedConsonants,
      includeGeneralCombiningMarks: this.context.includeGeneralCombiningMarks,
      ordered: this.context.ordered,
      seed: this.context.seed,
    };
  }

  private async handleWorkerMessage(state: WorkerState, message: GeneratedBatch | { error: string }) {
    state.busy = false;
    this.activeJobs = Math.max(0, this.activeJobs - 1);
    if ('error' in message) {
      this.fail(new Error(message.error));
      return;
    }
    await this.handleGeneratedResult(message);
    this.requestDispatch();
  }

  private async handleGeneratedResult(result: GeneratedBatch) {
    if (this.context.ordered) {
      this.orderedBuffer.set(`${result.partitionOrdinal}:${result.batchIndex}`, result);
      await this.flushOrdered();
    } else {
      await this.queue.push(result);
    }

    if (result.hasMore && result.nextCursor) {
      const partition = this.partitionsById.get(result.partitionId);
      if (partition) {
        this.pendingJobs.push({
          partition,
          cursor: result.nextCursor,
        });
      }
    }

    if (this.pendingJobs.length === 0 && this.activeJobs === 0 && this.orderedBuffer.size === 0) {
      this.closeQueue();
    }
  }

  private async flushOrdered() {
    while (true) {
      const key = `${this.currentPartitionOrdinal}:${this.currentBatchIndex}`;
      const result = this.orderedBuffer.get(key);
      if (!result) {
        break;
      }

      this.orderedBuffer.delete(key);
      await this.queue.push(result);

      if (result.hasMore) {
        this.currentBatchIndex++;
      } else {
        this.currentPartitionOrdinal++;
        this.currentBatchIndex = 0;
      }
    }
  }

  private closeQueue() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.queue.close();
    for (const state of this.workers) {
      void state.worker?.terminate();
    }
  }

  private fail(error: Error) {
    this.fatalError = error;
    this.closeQueue();
  }

  async nextBatch(): Promise<GeneratedBatch | null> {
    if (this.fatalError) {
      throw this.fatalError;
    }
    this.requestDispatch();
    const batch = await this.queue.shift();
    if (batch === null) {
      if (this.fatalError) {
        throw this.fatalError;
      }
      return null;
    }
    this.requestDispatch();
    return batch;
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.requestDispatch();
  }

  async close() {
    this.closeQueue();
  }
}
