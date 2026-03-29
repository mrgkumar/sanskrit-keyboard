import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseDatasetIds, resolveCorpusPreset } from '../test-support/corpusRegistry.ts';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');

const parseIntegerArg = (value: string | undefined) => {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    preset: 'sanskrit-default',
    canonicalDatasets: [] as string[],
    swaraDatasets: [] as string[],
    outputDir: path.resolve(APP_ROOT, 'test-support/fixtures/autocomplete'),
    canonicalLimit: null as number | null,
    runtimeLimit: null as number | null,
    swaraLimit: null as number | null,
    shardPrefixLength: null as number | null,
    skipCanonical: false,
    skipRuntime: false,
    skipSwara: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--preset' && next) {
      options.preset = next;
      index += 1;
      continue;
    }

    if (arg === '--canonical-datasets' && next) {
      options.canonicalDatasets = parseDatasetIds(next);
      index += 1;
      continue;
    }

    if (arg === '--swara-datasets' && next) {
      options.swaraDatasets = parseDatasetIds(next);
      index += 1;
      continue;
    }

    if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--canonical-limit' && next) {
      options.canonicalLimit = parseIntegerArg(next);
      index += 1;
      continue;
    }

    if (arg === '--runtime-limit' && next) {
      options.runtimeLimit = parseIntegerArg(next);
      index += 1;
      continue;
    }

    if (arg === '--swara-limit' && next) {
      options.swaraLimit = parseIntegerArg(next);
      index += 1;
      continue;
    }

    if (arg === '--shard-prefix-length' && next) {
      options.shardPrefixLength = parseIntegerArg(next);
      index += 1;
      continue;
    }

    if (arg === '--skip-canonical') {
      options.skipCanonical = true;
      continue;
    }

    if (arg === '--skip-runtime') {
      options.skipRuntime = true;
      continue;
    }

    if (arg === '--skip-swara') {
      options.skipSwara = true;
    }
  }

  return options;
};

const runScript = (scriptName: string, scriptArgs: string[]) => {
  const scriptPath = path.join(SCRIPT_DIR, scriptName);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', scriptPath, ...scriptArgs], {
    cwd: APP_ROOT,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${scriptName} failed with exit code ${result.status ?? 'unknown'}`);
  }
};

const main = () => {
  const options = parseArgs();
  const preset = resolveCorpusPreset(options.preset);
  const canonicalDatasets =
    options.canonicalDatasets.length > 0 ? options.canonicalDatasets : preset.canonicalDatasets;
  const swaraDatasets =
    options.swaraDatasets.length > 0 ? options.swaraDatasets : preset.swaraDatasets;
  const canonicalOutput = path.join(options.outputDir, 'canonical-mapping.ndjson');

  console.log(
    `[rebuildPredictionCorpus] preset=${options.preset} canonicalDatasets=${canonicalDatasets.join(',')} swaraDatasets=${swaraDatasets.join(',')} outputDir=${options.outputDir}`
  );

  if (!options.skipCanonical) {
    const args = ['--datasets', canonicalDatasets.join(','), '--output-dir', options.outputDir];
    if (options.canonicalLimit !== null) {
      args.push('--limit', String(options.canonicalLimit));
    }
    runScript('buildCanonicalLexicon.ts', args);
  }

  if (!options.skipRuntime) {
    const args = ['--input', canonicalOutput, '--output-dir', options.outputDir];
    if (options.runtimeLimit !== null) {
      args.push('--limit', String(options.runtimeLimit));
    }
    if (options.shardPrefixLength !== null) {
      args.push('--shard-prefix-length', String(options.shardPrefixLength));
    }
    runScript('buildRuntimeLexicon.ts', args);
  }

  if (!options.skipSwara) {
    const args = ['--datasets', swaraDatasets.join(','), '--output', path.join(options.outputDir, 'swara-lexicon.json')];
    if (options.swaraLimit !== null) {
      args.push('--limit', String(options.swaraLimit));
    }
    runScript('buildSwaraLexicon.ts', args);
  }
};

main();
