import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

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

interface ParseErrorRecord {
  type: 'parse_error';
  line: string;
  error: string;
}

interface WorkerInput {
  type: 'process_batch';
  batchId: number;
  lines: string[];
}

interface WorkerOutput {
  type: 'batch_result';
  batchId: number;
  processedRows: number;
  exactPasses: number;
  failures: number;
  skippedRows: number;
  records: CanonicalMappingRecord[];
  failedRecords: Array<CanonicalMappingRecord | ParseErrorRecord>;
}

interface SummaryReport {
  inputPath: string;
  outputDir: string;
  processedRows: number;
  exactPasses: number;
  failures: number;
  skippedRows: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  limit: number | null;
  workerCount: number;
  batchSize: number;
}

interface WorkerState {
  worker: Worker;
  busy: boolean;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_INPUT_PATH = path.resolve(WORKSPACE_ROOT, 'data_corpus/san/san_train.json');
const DEFAULT_OUTPUT_DIR = path.resolve(APP_ROOT, 'test-support/fixtures/autocomplete');
const DEFAULT_BATCH_SIZE = 2000;
const DEFAULT_PROGRESS_EVERY = 25000;
const DEFAULT_WORKER_COUNT = Math.max(1, Math.min(os.availableParallelism() - 1, 8));
const MAX_PENDING_BATCHES = DEFAULT_WORKER_COUNT * 4;

const parseIntegerArg = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT_PATH,
    outputDir: DEFAULT_OUTPUT_DIR,
    limit: null as number | null,
    progressEvery: DEFAULT_PROGRESS_EVERY,
    batchSize: DEFAULT_BATCH_SIZE,
    workers: DEFAULT_WORKER_COUNT,
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input' && next) {
      options.input = path.resolve(process.cwd(), next);
      index++;
      continue;
    }

    if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(process.cwd(), next);
      index++;
      continue;
    }

    if (arg === '--limit' && next) {
      options.limit = parseIntegerArg(next, 0);
      index++;
      continue;
    }

    if (arg === '--progress-every' && next) {
      options.progressEvery = parseIntegerArg(next, DEFAULT_PROGRESS_EVERY);
      index++;
      continue;
    }

    if (arg === '--batch-size' && next) {
      options.batchSize = parseIntegerArg(next, DEFAULT_BATCH_SIZE);
      index++;
      continue;
    }

    if (arg === '--workers' && next) {
      options.workers = parseIntegerArg(next, DEFAULT_WORKER_COUNT);
      index++;
    }
  }

  if (options.limit === 0) {
    options.limit = null;
  }

  return options;
};

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeNdjsonLine = (stream: fs.WriteStream, value: unknown) => {
  stream.write(`${JSON.stringify(value)}\n`);
};

const waitForDrain = (stream: fs.WriteStream) =>
  new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });

const main = async () => {
  const startedAt = new Date();
  const options = parseArgs();

  ensureDir(options.outputDir);

  const canonicalPath = path.join(options.outputDir, 'canonical-mapping.ndjson');
  const failuresPath = path.join(options.outputDir, 'forward-failures.ndjson');
  const summaryPath = path.join(options.outputDir, 'summary.json');
  const workerScriptPath = path.join(SCRIPT_DIR, 'buildCanonicalLexiconWorker.ts');

  const canonicalStream = fs.createWriteStream(canonicalPath, { encoding: 'utf8' });
  const failureStream = fs.createWriteStream(failuresPath, { encoding: 'utf8' });

  let processedRows = 0;
  let exactPasses = 0;
  let failures = 0;
  let skippedRows = 0;
  let nextBatchId = 0;
  let allInputDispatched = false;
  let mainLoopError: Error | null = null;

  const queue: WorkerInput[] = [];
  const workerStates: WorkerState[] = [];
  const inflight = new Set<number>();

  const flushBatchToStreams = async (result: WorkerOutput) => {
    for (const record of result.records) {
      if (!canonicalStream.write(`${JSON.stringify(record)}\n`)) {
        await waitForDrain(canonicalStream);
      }
    }

    for (const record of result.failedRecords) {
      if (!failureStream.write(`${JSON.stringify(record)}\n`)) {
        await waitForDrain(failureStream);
      }
    }
  };

  const maybeDispatch = () => {
    for (const state of workerStates) {
      if (state.busy || queue.length === 0) {
        continue;
      }

      const job = queue.shift()!;
      state.busy = true;
      inflight.add(job.batchId);
      state.worker.postMessage(job);
    }
  };

  const waitForQueueSpace = async () => {
    while (queue.length + inflight.size >= MAX_PENDING_BATCHES) {
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
    }
  };

  for (let index = 0; index < options.workers; index++) {
    const worker = new Worker(workerScriptPath, {
      execArgv: ['--experimental-strip-types'],
    });

    const state: WorkerState = { worker, busy: false };
    workerStates.push(state);

    worker.on('message', async (result: WorkerOutput) => {
      state.busy = false;
      inflight.delete(result.batchId);

      processedRows += result.processedRows;
      exactPasses += result.exactPasses;
      failures += result.failures;
      skippedRows += result.skippedRows;

      try {
        await flushBatchToStreams(result);
      } catch (error) {
        mainLoopError = error instanceof Error ? error : new Error(String(error));
      }

      if (processedRows > 0 && processedRows % options.progressEvery < result.processedRows) {
        console.log(
          `[buildCanonicalLexicon] processed=${processedRows} exactPasses=${exactPasses} failures=${failures} skipped=${skippedRows} inflight=${inflight.size} queued=${queue.length}`
        );
      }

      maybeDispatch();
    });

    worker.on('error', (error) => {
      mainLoopError = error;
    });
  }

  const input = fs.createReadStream(options.input, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    let currentBatch: string[] = [];
    let seenLines = 0;

    for await (const line of rl) {
      if (mainLoopError) {
        throw mainLoopError;
      }

      if (options.limit !== null && seenLines >= options.limit) {
        break;
      }

      seenLines++;
      currentBatch.push(line);

      if (currentBatch.length < options.batchSize) {
        continue;
      }

      await waitForQueueSpace();
      queue.push({
        type: 'process_batch',
        batchId: nextBatchId++,
        lines: currentBatch,
      });
      currentBatch = [];
      maybeDispatch();
    }

    if (currentBatch.length > 0) {
      queue.push({
        type: 'process_batch',
        batchId: nextBatchId++,
        lines: currentBatch,
      });
      maybeDispatch();
    }

    allInputDispatched = true;

    while ((queue.length > 0 || inflight.size > 0) && !mainLoopError) {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    }

    if (mainLoopError) {
      throw mainLoopError;
    }
  } finally {
    rl.close();
  }

  await Promise.all(workerStates.map(async ({ worker }) => worker.terminate().catch(() => undefined)));

  canonicalStream.end();
  failureStream.end();

  await Promise.all([
    new Promise<void>((resolve) => canonicalStream.on('finish', () => resolve())),
    new Promise<void>((resolve) => failureStream.on('finish', () => resolve())),
  ]);

  if (!allInputDispatched) {
    throw new Error('Canonical lexicon build did not complete all input dispatch');
  }

  const finishedAt = new Date();
  const summary: SummaryReport = {
    inputPath: options.input,
    outputDir: options.outputDir,
    processedRows,
    exactPasses,
    failures,
    skippedRows,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    limit: options.limit,
    workerCount: options.workers,
    batchSize: options.batchSize,
  };

  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(
    `[buildCanonicalLexicon] done processed=${processedRows} exactPasses=${exactPasses} failures=${failures} skipped=${skippedRows} workers=${options.workers} batchSize=${options.batchSize} outputDir=${options.outputDir}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
