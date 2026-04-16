import { parentPort, workerData } from 'node:worker_threads';
import type { BatchRequest, GenerationContext } from './types.ts';
import type { CuratedInventories } from './curatedInventories.ts';
import type { PartitionDescriptor } from './partition.ts';
import type { BatchCursor } from './types.ts';
import { generatePartitionBatch } from './generator.ts';

interface WorkerJob {
  request: BatchRequest;
  partition: PartitionDescriptor;
  cursor: BatchCursor;
}

interface WorkerPayload {
  context: GenerationContext;
  inventories: CuratedInventories;
}

if (!parentPort) {
  throw new Error('devanagari worker must run inside worker_threads');
}

const payload = workerData as WorkerPayload;

parentPort.on('message', (message: WorkerJob) => {
  try {
    const result = generatePartitionBatch(message.partition, message.cursor, message.request, payload.context, payload.inventories);
    parentPort!.postMessage(result);
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
