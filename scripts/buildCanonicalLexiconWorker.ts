import { parentPort } from 'node:worker_threads';
import type { CanonicalRecordConfig } from '../test-support/corpusRegistry.ts';
import {
  processCanonicalRow,
  type CanonicalMappingRecord,
} from './buildCanonicalLexiconShared.ts';

interface WorkerInput {
  type: 'process_batch';
  batchId: number;
  lines: string[];
  datasetId: string;
  config: CanonicalRecordConfig;
}

interface WorkerOutput {
  type: 'batch_result';
  batchId: number;
  processedRows: number;
  exactPasses: number;
  failures: number;
  skippedRows: number;
  records: CanonicalMappingRecord[];
  failedRecords: Array<CanonicalMappingRecord | { type: 'parse_error'; line: string; error: string }>;
}

if (!parentPort) {
  throw new Error('buildCanonicalLexiconWorker.ts must run inside a worker thread');
}

parentPort.on('message', (message: WorkerInput) => {
  if (message.type !== 'process_batch') {
    return;
  }

  const records: CanonicalMappingRecord[] = [];
  const failedRecords: WorkerOutput['failedRecords'] = [];
  let processedRows = 0;
  let exactPasses = 0;
  let failures = 0;
  let skippedRows = 0;

  for (const line of message.lines) {
    if (!line.trim()) {
      continue;
    }

    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line) as Record<string, unknown>;
    } catch (error) {
      skippedRows++;
      failedRecords.push({
        type: 'parse_error',
        line,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const record = processCanonicalRow({
      row,
      config: message.config,
      rowId: `batch-${message.batchId}-row-${processedRows + skippedRows + 1}`,
      datasetId: message.datasetId,
    });
    if (!record) {
      skippedRows++;
      continue;
    }

    records.push(record);
    processedRows++;

    if (record.forwardStatus === 'exact_pass') {
      exactPasses++;
    } else {
      failures++;
      failedRecords.push(record);
    }
  }

  const output: WorkerOutput = {
    type: 'batch_result',
    batchId: message.batchId,
    processedRows,
    exactPasses,
    failures,
    skippedRows,
    records,
    failedRecords,
  };

  parentPort!.postMessage(output);
});
