import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { detransliterate } from '../src/lib/vedic/utils.ts';

interface SwaraVariantRecord {
  count: number;
  devanagari: string;
}

interface SwaraLexiconEntry {
  normalized: string;
  variants: Array<{
    itrans: string;
    devanagari: string;
    count: number;
  }>;
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_INPUT_PATH = path.resolve(APP_ROOT, '../archive/example.txt');
const DEFAULT_OUTPUT_PATH = path.resolve(APP_ROOT, 'test-support/fixtures/autocomplete/swara-lexicon.json');

const TOKEN_REGEX =
  /[\p{Script_Extensions=Devanagari}\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]+/gu;
const LEXICAL_LOOKUP_SWARA_PATTERN = /\\?(?:''|['"_^])/g;

const normalizeForLexicalLookup = (value: string) =>
  value.replace(LEXICAL_LOOKUP_SWARA_PATTERN, '').trim();

const shouldLookupLexicalSuggestions = (value: string) =>
  value.length >= 2 && /[A-Za-z]/.test(value);

const hasLexicalSvaraMarkers = (value: string) =>
  normalizeForLexicalLookup(value) !== value;

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    input: DEFAULT_INPUT_PATH,
    output: DEFAULT_OUTPUT_PATH,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const next = args[index + 1];

    if (arg === '--input' && next) {
      options.input = path.resolve(process.cwd(), next);
      index += 1;
      continue;
    }

    if (arg === '--output' && next) {
      options.output = path.resolve(process.cwd(), next);
      index += 1;
    }
  }

  return options;
};

const tokenize = (text: string) =>
  [...text.matchAll(TOKEN_REGEX)]
    .map((match) => match[0].trim())
    .filter(Boolean);

const main = () => {
  const options = parseArgs();
  const source = fs.readFileSync(options.input, 'utf8');
  const tokens = tokenize(source);
  const variantsByNormalized = new Map<string, Map<string, SwaraVariantRecord>>();

  for (const token of tokens) {
    const itrans = detransliterate(token);
    const normalized = normalizeForLexicalLookup(itrans);

    if (!shouldLookupLexicalSuggestions(normalized) || !hasLexicalSvaraMarkers(itrans)) {
      continue;
    }

    const entry = variantsByNormalized.get(normalized) ?? new Map<string, SwaraVariantRecord>();
    const existing = entry.get(itrans);
    if (existing) {
      existing.count += 1;
    } else {
      entry.set(itrans, {
        count: 1,
        devanagari: token,
      });
    }
    variantsByNormalized.set(normalized, entry);
  }

  const entries: SwaraLexiconEntry[] = [...variantsByNormalized.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalized, variants]) => ({
      normalized,
      variants: [...variants.entries()]
        .map(([itrans, record]) => ({
          itrans,
          devanagari: record.devanagari,
          count: record.count,
        }))
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return left.itrans.localeCompare(right.itrans);
        }),
    }));

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(
    options.output,
    `${JSON.stringify(
      {
        version: 1,
        inputPath: options.input,
        entryCount: entries.length,
        entries,
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        inputPath: options.input,
        outputPath: options.output,
        tokenCount: tokens.length,
        entryCount: entries.length,
      },
      null,
      2
    )
  );
};

main();
