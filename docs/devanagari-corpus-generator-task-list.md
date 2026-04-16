# Devanagari Corpus Generator Task List

Status values:
- not started
- started
- implemented
- reviewed + refined
- commited
- done

## T01 - Source Inventory And Classification

Status: not started

Goal:
Create the prompt-derived authoritative inventory and classify every supplied code point without flattening it into a single alphabet.

Validation gates:
- Required base consonants are present.
- Required extended consonants are present and classified.
- Required vowels and dependent signs are present and classified.
- Punctuation, symbols, and private-use/font-specific glyphs are not included in default generation.
- Duplicates and unknowns are reported explicitly.

## T02 - Inventory Audit Outputs

Status: not started

Goal:
Write deterministic inventory outputs for inspection and regression checks.

Validation gates:
- `output/inventory/classification.json` exists.
- `output/inventory/audit.json` exists.
- JSON contents are stable across runs.

## T03 - Curated Inventories

Status: not started

Goal:
Build the generation inventories used by templates and validation.

Validation gates:
- Default inventories exclude punctuation, symbols, and private-use/font-specific glyphs.
- Vedic and general combining marks are opt-in.

## T04 - Templates And Validator

Status: not started

Goal:
Generate only rule-template candidates and enforce orthographic constraints.

Validation gates:
- Virama placement is valid.
- Nukta host placement is valid.
- Matra host placement is valid.
- Exact code-point length is enforced.

## T05 - Deterministic Generator

Status: not started

Goal:
Produce deterministic `CorpusEntry` records with stable IDs and normalized text variants.

Validation gates:
- Same seed and config produce the same items.
- Different seeds can change deterministic ordering.
- Metadata matches generated text.

## T06 - Partitioning

Status: not started

Goal:
Split the search space into deterministic template/prefix partitions.

Validation gates:
- Partition ordering is stable.
- Single-thread and multi-thread logical output match in ordered mode.

## T07 - Bounded Queue

Status: not started

Goal:
Add a backpressure-aware bounded async queue between workers and consumers.

Validation gates:
- Queue size never grows without bound.
- Push waits when the queue reaches the high-water mark.

## T08 - Worker Producer

Status: not started

Goal:
Generate batches in worker threads and return them to the coordinator.

Validation gates:
- `worker_threads` are used.
- Worker errors propagate cleanly.
- Single-thread fallback still works.

## T09 - Public Producer API

Status: not started

Goal:
Expose `createCorpusProducer`, `getNextBatch`, `iterateBatches`, `iterateEntries`, `reset`, `pause`, `resume`, and `close`.

Validation gates:
- `getNextBatch({ length: 5, batchSize: 1000 })` works.
- Async iteration works.
- Pause/resume/close behave correctly.

## T10 - Record And Replay

Status: not started

Goal:
Add optional JSONL record/replay support without making persistence part of the main path.

Validation gates:
- Record mode writes JSONL and manifest files.
- Replay mode reproduces the recorded batches.

## T11 - CLI

Status: not started

Goal:
Provide a small CLI for stream/record/replay workflows.

Validation gates:
- Required flags are parsed.
- Stream mode is the default.
- Record and replay modes function.

## T12 - Tests

Status: not started

Goal:
Add focused regression tests for classification, validation, generation, queueing, and replay.

Validation gates:
- Classification tests pass.
- Generator tests pass.
- Queue and replay tests pass.

## T13 - README

Status: not started

Goal:
Document the primary stream-first workflow and the optional record/replay modes.

Validation gates:
- Usage examples match the implementation.
- The README explains code-point length semantics.

## T14 - Final Review And Commit

Status: not started

Goal:
Run final checks, refine as needed, and commit the implementation.

Validation gates:
- Lint passes.
- Targeted tests pass.
- Working tree only contains intended changes.
