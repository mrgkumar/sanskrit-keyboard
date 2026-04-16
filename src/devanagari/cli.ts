import { join } from 'node:path';
import { createCorpusProducer } from './producer.ts';
import type { ProducerConfig, TemplateFamily } from './types.ts';

const parseArgs = (argv: string[]) => {
  const result: Record<string, string | boolean | number | undefined> = {};
  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      continue;
    }
    const [rawKey, rawValue = 'true'] = arg.slice(2).split('=');
    const normalizedValue =
      rawValue === 'true' ? true : rawValue === 'false' ? false : Number.isNaN(Number(rawValue)) ? rawValue : Number(rawValue);
    result[rawKey] = normalizedValue;
  }
  return result;
};

const toBoolean = (value: string | boolean | number | undefined, fallback = false) =>
  typeof value === 'boolean' ? value : typeof value === 'string' ? value === 'true' : typeof value === 'number' ? value !== 0 : fallback;

const toNumber = (value: string | boolean | number | undefined, fallback: number) =>
  typeof value === 'number' ? value : typeof value === 'string' ? Number(value) || fallback : fallback;

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const mode = (args.mode as 'stream' | 'record' | 'replay' | undefined) ?? 'stream';
  const producerConfig: ProducerConfig = {
    mode,
    ordered: toBoolean(args.ordered, true),
    workers: toNumber(args.workers, 1),
    queueHighWaterMark: toNumber(args['queue-high-water-mark'], 16),
    seed: toNumber(args.seed, 1),
    includeExtendedConsonants: toBoolean(args['include-extended-consonants'], false),
    includeVedic: toBoolean(args['include-vedic'], false),
    includeGeneralCombiningMarks: toBoolean(args['include-general-combining-marks'], false),
    recordDir: typeof args['record-dir'] === 'string' ? join(process.cwd(), String(args['record-dir'])) : undefined,
    replayDir: typeof args['replay-dir'] === 'string' ? join(process.cwd(), String(args['replay-dir'])) : undefined,
    templates:
      typeof args.templates === 'string'
        ? (String(args.templates)
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean) as TemplateFamily[])
        : undefined,
  };

  const length = toNumber(args.length, 5);
  const batchSize = toNumber(args['batch-size'], 1000);
  const maxBatches = typeof args['max-batches'] === 'number' ? args['max-batches'] : undefined;

  const producer = createCorpusProducer(producerConfig);
  try {
    let emitted = 0;
    while (true) {
      const batch = await producer.getNextBatch({
        length,
        batchSize,
        templates: producerConfig.templates,
        includeVedic: producerConfig.includeVedic,
        includeExtendedConsonants: producerConfig.includeExtendedConsonants,
        includeGeneralCombiningMarks: producerConfig.includeGeneralCombiningMarks,
        ordered: producerConfig.ordered,
        seed: producerConfig.seed,
      });
      process.stdout.write(`${JSON.stringify(batch)}\n`);
      emitted++;
      if (!batch.hasMore || (maxBatches !== undefined && emitted >= maxBatches)) {
        break;
      }
    }
  } finally {
    await producer.close();
  }
};

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
