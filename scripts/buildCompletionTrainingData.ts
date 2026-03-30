import path from 'node:path';

import { getAutocompleteDataRoot } from '../src/lib/server/autocompleteDataRoot.ts';
import {
  buildCompletionPrefixExamples,
  buildCompletionTable,
  loadCanonicalTrainingRecords,
  loadSwaraExactForms,
  writeCompletionTrainingArtifacts,
} from '../test-support/completionTrainingData.ts';

const DEFAULT_OUTPUT_DIR = getAutocompleteDataRoot();

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
    input: path.resolve(DEFAULT_OUTPUT_DIR, 'canonical-mapping.ndjson'),
    swara: path.resolve(DEFAULT_OUTPUT_DIR, 'swara-lexicon.json'),
    outputDir: DEFAULT_OUTPUT_DIR,
    limit: null as number | null,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input' && next) {
      options.input = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--swara' && next) {
      options.swara = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--limit' && next) {
      options.limit = parseIntegerArg(next);
      index += 1;
    }
  }

  return options;
};

const main = async () => {
  const options = parseArgs();
  const { processedRows, records } = await loadCanonicalTrainingRecords(options.input, options.limit);
  const completionTable = buildCompletionTable({
    canonicalRecords: records,
    swaraExactForms: loadSwaraExactForms(options.swara),
  });
  const prefixExamples = buildCompletionPrefixExamples(completionTable);

  await writeCompletionTrainingArtifacts({
    outputDir: options.outputDir,
    completionTable,
    prefixExamples,
    summary: {
      inputPath: options.input,
      swaraPath: options.swara,
      outputDir: options.outputDir,
      processedRows,
      entryCount: completionTable.length,
      prefixExampleCount: prefixExamples.length,
    },
  });

  console.log(
    JSON.stringify(
      {
        inputPath: options.input,
        swaraPath: options.swara,
        outputDir: options.outputDir,
        processedRows,
        entryCount: completionTable.length,
        prefixExampleCount: prefixExamples.length,
      },
      null,
      2
    )
  );
};

void main();
