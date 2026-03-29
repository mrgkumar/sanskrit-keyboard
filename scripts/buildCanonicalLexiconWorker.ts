import { parentPort } from 'node:worker_threads';
import { extractCanonicalRow, type CanonicalRecordConfig } from '../test-support/corpusRegistry.ts';
import { stripDevanagariLexicalMarks } from '../test-support/corpusText.ts';
import { normalizeForLexicalLookup } from '../src/lib/vedic/lexicalNormalization.ts';
import { detransliterate, transliterate } from '../src/lib/vedic/utils.ts';

interface WorkerInput {
  type: 'process_batch';
  batchId: number;
  lines: string[];
  datasetId: string;
  config: CanonicalRecordConfig;
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

    const extracted = extractCanonicalRow(
      message.config,
      row,
      `batch-${message.batchId}-row-${processedRows + skippedRows + 1}`,
      message.datasetId
    );
    if (!extracted) {
      skippedRows++;
      continue;
    }

    const rawItrans =
      message.config.mode === 'from_itrans' && extracted.itrans
        ? extracted.itrans
        : detransliterate(extracted.devanagari);
    const itrans = extracted.normalizeForLexicon
      ? normalizeForLexicalLookup(rawItrans)
      : rawItrans;
    if (!itrans || (extracted.normalizeForLexicon && !/[A-Za-z]/.test(itrans))) {
      skippedRows++;
      continue;
    }
    const forwardUnicode = transliterate(itrans).unicode;
    const expectedUnicode =
      extracted.normalizeForLexicon
        ? stripDevanagariLexicalMarks(extracted.devanagari)
        : message.config.mode === 'from_itrans' && extracted.devanagari
        ? extracted.devanagari
        : extracted.devanagari || forwardUnicode;
    const forwardStatus: CanonicalMappingRecord['forwardStatus'] =
      forwardUnicode === expectedUnicode ? 'exact_pass' : 'fail';

    const record: CanonicalMappingRecord = {
      id: extracted.id,
      devanagari: expectedUnicode,
      itrans,
      originalRoman: extracted.originalRoman,
      source: extracted.source,
      score: extracted.score,
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
