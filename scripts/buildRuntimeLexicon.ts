import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';

interface CanonicalMappingRecord {
  devanagari: string;
  itrans: string;
}

interface RuntimeLexiconEntry {
  itrans: string;
  devanagari: string;
  count: number;
}

interface OutputManifestEntry {
  prefix: string;
  file: string;
  entryCount: number;
  bytes: number;
}

interface RuntimeLexiconSummary {
  inputPath: string;
  outputDir: string;
  tempBucketDir: string;
  processedRows: number;
  entryCount: number;
  shardPrefixLength: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  singleFile: {
    file: string;
    bytes: number;
  };
  sharded: {
    dir: string;
    manifestFile: string;
    totalBytes: number;
    shardCount: number;
    largestShard: OutputManifestEntry | null;
  };
}

const DEFAULT_OUTPUT_DIR = getAutocompleteDataRoot();
const DEFAULT_INPUT_PATH = path.resolve(DEFAULT_OUTPUT_DIR, 'canonical-mapping.ndjson');
const DEFAULT_TEMP_BUCKET_DIR = path.resolve(DEFAULT_OUTPUT_DIR, '.runtime-lexicon-buckets');
const DEFAULT_SHARD_PREFIX_LENGTH = 2;

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
    tempBucketDir: DEFAULT_TEMP_BUCKET_DIR,
    shardPrefixLength: DEFAULT_SHARD_PREFIX_LENGTH,
    limit: null as number | null,
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

    if (arg === '--temp-dir' && next) {
      options.tempBucketDir = path.resolve(process.cwd(), next);
      index++;
      continue;
    }

    if (arg === '--shard-prefix-length' && next) {
      options.shardPrefixLength = parseIntegerArg(next, DEFAULT_SHARD_PREFIX_LENGTH);
      index++;
      continue;
    }

    if (arg === '--limit' && next) {
      options.limit = parseIntegerArg(next, 0);
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

const removeDirIfPresent = (dirPath: string) => {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
};

const waitForDrain = (stream: fs.WriteStream) =>
  new Promise<void>((resolve) => {
    stream.once('drain', resolve);
  });

const waitForFinish = (stream: fs.WriteStream) =>
  new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

const toBucketPrefix = (itrans: string, prefixLength: number) =>
  Array.from(itrans).slice(0, prefixLength).join('') || '_';

const encodeBucketKey = (value: string) =>
  Array.from(value)
    .map((char) => char.codePointAt(0)!.toString(16).padStart(4, '0'))
    .join('-');

const createSingleLexiconFile = (
  outputPath: string,
  entryCount: number,
  processedRows: number,
  dedupedBucketPaths: string[]
) =>
  new Promise<number>(async (resolve, reject) => {
    const output = fs.createWriteStream(outputPath, { encoding: 'utf8' });
    output.on('error', reject);

    try {
      output.write('{\n');
      output.write('  "version": 1,\n');
      output.write(`  "entryCount": ${entryCount},\n`);
      output.write(`  "processedRows": ${processedRows},\n`);
      output.write('  "entries": [\n');

      let isFirstEntry = true;

      for (const bucketPath of dedupedBucketPaths) {
        const rl = readline.createInterface({
          input: fs.createReadStream(bucketPath, { encoding: 'utf8' }),
          crlfDelay: Infinity,
        });

        for await (const line of rl) {
          const prefix = isFirstEntry ? '    ' : ',\n    ';
          if (!output.write(`${prefix}${line}`)) {
            await waitForDrain(output);
          }
          isFirstEntry = false;
        }
      }

      output.write('\n  ]\n');
      output.write('}\n');
      output.end();
      await waitForFinish(output);
      resolve(fs.statSync(outputPath).size);
    } catch (error) {
      reject(error);
    }
  });

const createShardedLexiconFiles = async (
  outputDir: string,
  dedupedBucketPaths: string[],
  shardPrefixLength: number
) => {
  const shardDir = path.join(outputDir, 'runtime-lexicon-shards');
  const manifestPath = path.join(outputDir, 'runtime-lexicon-shards-manifest.json');
  removeDirIfPresent(shardDir);
  ensureDir(shardDir);

  const openShards = new Map<
    string,
    {
      stream: fs.WriteStream;
      entryCount: number;
      hasEntries: boolean;
      file: string;
    }
  >();

  const manifest: OutputManifestEntry[] = [];

  for (const bucketPath of dedupedBucketPaths) {
    const rl = readline.createInterface({
      input: fs.createReadStream(bucketPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      const entry = JSON.parse(line) as RuntimeLexiconEntry;
      const prefix = toBucketPrefix(entry.itrans, shardPrefixLength);
      const fileName = `${encodeBucketKey(prefix)}.json`;

      if (!openShards.has(prefix)) {
        const file = path.join(shardDir, fileName);
        const stream = fs.createWriteStream(file, { encoding: 'utf8' });
        stream.write('{\n');
        stream.write('  "version": 1,\n');
        stream.write(`  "prefix": ${JSON.stringify(prefix)},\n`);
        stream.write('  "entries": [\n');
        openShards.set(prefix, {
          stream,
          entryCount: 0,
          hasEntries: false,
          file,
        });
      }

      const shard = openShards.get(prefix)!;
      const serialized = JSON.stringify(entry);
      const prefixSeparator = shard.hasEntries ? ',\n    ' : '    ';
      if (!shard.stream.write(`${prefixSeparator}${serialized}`)) {
        await waitForDrain(shard.stream);
      }
      shard.hasEntries = true;
      shard.entryCount++;
    }
  }

  for (const [prefix, shard] of [...openShards.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    shard.stream.write('\n  ]\n');
    shard.stream.write('}\n');
    shard.stream.end();
    await waitForFinish(shard.stream);

    const relativeFile = path.relative(outputDir, shard.file);
    manifest.push({
      prefix,
      file: relativeFile,
      entryCount: shard.entryCount,
      bytes: fs.statSync(shard.file).size,
    });
  }

  const totalBytes = manifest.reduce((sum, item) => sum + item.bytes, 0);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify({ version: 1, shards: manifest }, null, 2)}\n`,
    'utf8'
  );

  return {
    dir: path.relative(outputDir, shardDir),
    manifestFile: path.relative(outputDir, manifestPath),
    totalBytes,
    shardCount: manifest.length,
    largestShard:
      manifest.length > 0
        ? manifest.reduce((largest, current) => (current.bytes > largest.bytes ? current : largest))
        : null,
  };
};

const finalizeBucket = async (
  bucketPath: string,
  dedupedBucketPath: string
) => {
  const entries = new Map<
    string,
    {
      count: number;
      devanagariCounts: Map<string, number>;
    }
  >();

  const rl = readline.createInterface({
    input: fs.createReadStream(bucketPath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const record = JSON.parse(line) as CanonicalMappingRecord;
    const current = entries.get(record.itrans) ?? {
      count: 0,
      devanagariCounts: new Map<string, number>(),
    };

    current.count++;
    current.devanagariCounts.set(
      record.devanagari,
      (current.devanagariCounts.get(record.devanagari) ?? 0) + 1
    );
    entries.set(record.itrans, current);
  }

  const dedupedEntries: RuntimeLexiconEntry[] = [];
  for (const [itrans, value] of entries) {
    let representative = '';
    let representativeCount = -1;

    for (const [devanagari, count] of value.devanagariCounts) {
      if (
        count > representativeCount ||
        (count === representativeCount && devanagari.localeCompare(representative) < 0)
      ) {
        representative = devanagari;
        representativeCount = count;
      }
    }

    dedupedEntries.push({
      itrans,
      devanagari: representative,
      count: value.count,
    });
  }

  dedupedEntries.sort((left, right) => left.itrans.localeCompare(right.itrans));
  fs.writeFileSync(
    dedupedBucketPath,
    `${dedupedEntries.map((entry) => JSON.stringify(entry)).join('\n')}${dedupedEntries.length > 0 ? '\n' : ''}`,
    'utf8'
  );

  return dedupedEntries.length;
};

const main = async () => {
  const startedAt = new Date();
  const options = parseArgs();
  const runtimeLexiconPath = path.join(options.outputDir, 'runtime-lexicon.json');
  const runtimeLexiconSummaryPath = path.join(options.outputDir, 'runtime-lexicon-summary.json');
  const dedupedBucketDir = path.join(options.outputDir, '.runtime-lexicon-deduped');

  ensureDir(options.outputDir);
  removeDirIfPresent(options.tempBucketDir);
  removeDirIfPresent(dedupedBucketDir);
  ensureDir(options.tempBucketDir);
  ensureDir(dedupedBucketDir);

  let processedRows = 0;
  const bucketStreams = new Map<string, fs.WriteStream>();

  const input = fs.createReadStream(options.input, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input,
    crlfDelay: Infinity,
  });

  try {
    for await (const line of rl) {
      if (options.limit !== null && processedRows >= options.limit) {
        break;
      }

      if (!line.trim()) {
        continue;
      }

      const record = JSON.parse(line) as CanonicalMappingRecord;
      const bucketPrefix = toBucketPrefix(record.itrans, options.shardPrefixLength);
      const encodedBucket = encodeBucketKey(bucketPrefix);

      if (!bucketStreams.has(encodedBucket)) {
        const bucketPath = path.join(options.tempBucketDir, `${encodedBucket}.ndjson`);
        bucketStreams.set(encodedBucket, fs.createWriteStream(bucketPath, { encoding: 'utf8' }));
      }

      const stream = bucketStreams.get(encodedBucket)!;
      const serialized = JSON.stringify({
        itrans: record.itrans,
        devanagari: record.devanagari,
      });

      if (!stream.write(`${serialized}\n`)) {
        await waitForDrain(stream);
      }

      processedRows++;
      if (processedRows > 0 && processedRows % 250000 === 0) {
        console.log(`[buildRuntimeLexicon] bucketed=${processedRows}`);
      }
    }
  } finally {
    rl.close();
  }

  for (const stream of bucketStreams.values()) {
    stream.end();
  }
  await Promise.all([...bucketStreams.values()].map((stream) => waitForFinish(stream)));

  const tempBucketPaths = fs
    .readdirSync(options.tempBucketDir)
    .filter((file) => file.endsWith('.ndjson'))
    .sort()
    .map((file) => path.join(options.tempBucketDir, file));

  const dedupedBucketPaths: string[] = [];
  let entryCount = 0;

  for (const bucketPath of tempBucketPaths) {
    const dedupedPath = path.join(dedupedBucketDir, path.basename(bucketPath));
    const bucketEntries = await finalizeBucket(bucketPath, dedupedPath);
    entryCount += bucketEntries;
    dedupedBucketPaths.push(dedupedPath);
  }

  const singleFileBytes = await createSingleLexiconFile(
    runtimeLexiconPath,
    entryCount,
    processedRows,
    dedupedBucketPaths
  );
  const sharded = await createShardedLexiconFiles(
    options.outputDir,
    dedupedBucketPaths,
    options.shardPrefixLength
  );

  removeDirIfPresent(options.tempBucketDir);
  removeDirIfPresent(dedupedBucketDir);

  const finishedAt = new Date();
  const summary: RuntimeLexiconSummary = {
    inputPath: options.input,
    outputDir: options.outputDir,
    tempBucketDir: options.tempBucketDir,
    processedRows,
    entryCount,
    shardPrefixLength: options.shardPrefixLength,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    singleFile: {
      file: path.relative(options.outputDir, runtimeLexiconPath),
      bytes: singleFileBytes,
    },
    sharded,
  };

  fs.writeFileSync(runtimeLexiconSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(
    `[buildRuntimeLexicon] done processed=${processedRows} entryCount=${entryCount} singleBytes=${singleFileBytes} shardCount=${sharded.shardCount} shardBytes=${sharded.totalBytes}`
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
