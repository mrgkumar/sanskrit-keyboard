# Devanagari Corpus Generator

This module builds a deterministic Devanagari test corpus for workflow and validator testing.

For the non-negotiable transliteration and display rules that this corpus is meant to protect, see:

- [Transliteration And Display Invariants](../../docs/transliteration-display-invariants.md)

## Primary Workflow

The default path is stream-first:

```ts
import { createCorpusProducer } from './producer.ts';

const producer = createCorpusProducer({ workers: 4, ordered: true, seed: 7 });
const batch = await producer.getNextBatch({
  length: 5,
  batchSize: 1000,
  templates: ['plain', 'virama'],
});
```

The result batches are generated on demand. No static corpus or SQLite store is required for the main path.

## Record And Replay

- `mode: "record"` writes one JSONL file per emitted batch plus a manifest.
- `mode: "replay"` consumes the saved JSONL files instead of generating new batches.

## Rules

- Length is measured in Unicode code points, not grapheme clusters.
- Virama must stay between consonants.
- Nukta and dependent vowel signs must follow valid hosts.
- Punctuation, symbols, and private-use/font-specific code points are excluded by default.
- Vedic marks are opt-in.

## CLI

```bash
node --experimental-strip-types src/devanagari/cli.ts \
  --length=5 \
  --batch-size=1000 \
  --workers=8 \
  --templates=plain,virama,matra \
  --mode=stream \
  --ordered=true
```

## Output Artifacts

Inventory audit files are written to:

- `output/inventory/classification.json`
- `output/inventory/audit.json`

Record mode writes:

- `output/manifest.json`
- `output/recordings/batch_000001.jsonl`
