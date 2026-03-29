import { parentPort } from 'node:worker_threads';
import { detransliterate, transliterate } from '../src/lib/vedic/utils.ts';

interface CorpusRow {
  unique_identifier?: string;
  'native word'?: string;
  'english word'?: string;
  source?: string | null;
  score?: number | null;
}

interface WorkerInput {
  type: 'process_batch';
  batchId: number;
  lines: string[];
}

interface CanonicalMappingRecord {
  id: string;
  devanagari: string;
  itrans: string;
  originalRoman: string;
  source: string | null;
  score: number | null;
  forwardUnicode: string;
  forwardStatus: 'exact_pass' | 'fail';
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

    let row: CorpusRow;
    try {
      row = JSON.parse(line) as CorpusRow;
    } catch (error) {
      skippedRows++;
      failedRecords.push({
        type: 'parse_error',
        line,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const devanagari = row['native word']?.trim() ?? '';
    if (!devanagari) {
      skippedRows++;
      continue;
    }

    const itrans = detransliterate(devanagari);
    const forwardUnicode = transliterate(itrans).unicode;
    const forwardStatus: CanonicalMappingRecord['forwardStatus'] =
      forwardUnicode === devanagari ? 'exact_pass' : 'fail';

    const record: CanonicalMappingRecord = {
      id: row.unique_identifier ?? `batch-${message.batchId}-row-${processedRows + skippedRows + 1}`,
      devanagari,
      itrans,
      originalRoman: row['english word']?.trim() ?? '',
      source: row.source ?? null,
      score: row.score ?? null,
      forwardUnicode,
      forwardStatus,
    };

    records.push(record);
    processedRows++;

    if (forwardStatus === 'exact_pass') {
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
