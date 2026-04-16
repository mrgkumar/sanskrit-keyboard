import { parentPort, workerData } from 'node:worker_threads';
import type { BatchRequest, GenerationContext, WorkerGeneratedBatch } from './types.ts';
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
    const compactResult: WorkerGeneratedBatch = {
      partitionId: result.partitionId,
      partitionOrdinal: result.partitionOrdinal,
      batchIndex: result.batchIndex,
      batchId: result.batchId,
      templateId: result.templateId,
      items: result.items.map((item) => ({ text: item.text })),
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    };
    parentPort!.postMessage(compactResult);
  } catch (error) {
    parentPort!.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
