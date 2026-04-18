# Large Document Performance Plan

This plan addresses UI lag when loading, restoring, pasting, or editing large Sanskrit Keyboard documents, especially Roman/ITRANS source text above roughly 50,000 characters.

The goal is not only to show progress. The goal is to keep the app responsive while preserving document correctness, session integrity, and transliteration behavior.

## 1. Problem Statement

Large documents currently create visible UI lag during:

1. loading previous saved sessions
2. resuming the latest session from the landing screen
3. selecting saved sessions from the workspace panel
4. pasting/importing large Roman or Devanagari text
5. rendering large read/document surfaces after restore
6. autosaving large snapshots after a restore/import

The lag is expected because several expensive operations currently happen synchronously on the main thread.

## 2. Current Hot Paths

### Saved session restore

Current restore flow:

1. `readStoredSessionSnapshot(sessionId)` reads the full session JSON from `localStorage`.
2. `JSON.parse(raw)` parses the full session synchronously.
3. `loadSessionSnapshot(snapshot)` sets all blocks into Zustand immediately.
4. `loadSessionSnapshot` synchronously derives:
   - `deriveSessionLexicalUsageFromBlocks(snapshot.blocks)`
   - `deriveSessionExactFormUsageFromBlocks(snapshot.blocks)`
5. React renders the restored document surfaces.
6. Autosave can run shortly after restore and stringify/write the large session back to `localStorage`.

Key files:

1. `src/store/flowStoreSessions.ts`
2. `src/store/useFlowStore.ts`
3. `src/components/engine/SessionLanding.tsx`
4. `src/components/engine/TransliterationEngine.tsx`

### Large paste/import

Current paste/import flow:

1. `StickyTopComposer` handles paste.
2. Multi-line input calls `addBlocks()`.
3. `addBlocks()` calls `createBlockFromSource()` for each block.
4. `createBlockFromSource()` transliterates synchronously.
5. Store derives lexical usage from all blocks.
6. React renders the updated workspace.
7. Autosave serializes the large session.

Key files:

1. `src/components/StickyTopComposer.tsx`
2. `src/store/useFlowStore.ts`
3. `src/store/flowStoreSegmentation.ts`

## 3. Primary Bottlenecks

The main risks are:

1. synchronous `localStorage.getItem()` and `localStorage.setItem()`
2. synchronous `JSON.parse()` and `JSON.stringify()`
3. synchronous transliteration over many blocks/segments
4. synchronous lexical usage derivation
5. rendering too many block surfaces at once
6. autosave running immediately after large restore/import

Progress UI improves perception but does not solve these blockers unless the work is actually split, deferred, or moved off the main thread.

## 4. Design Principles

1. The canonical ITRANS source remains the document source of truth.
2. Large-session restore must never silently load only part of the document as if it were complete.
3. Copy/export/save actions must not operate on an incomplete document unless the UI clearly blocks or labels the state.
4. The editor should become usable as soon as safely possible, but not by corrupting session state.
5. Non-critical indexes, especially lexical learning, should not block first usable render.
6. Autosave should not run during restore/import and should run once after completion.
7. Worker progress should be coarse-grained and throttled to avoid creating more render churn than it prevents.
8. Read/document rendering must eventually be virtualized or windowed for very large documents.

## 5. Recommended Architecture

Introduce a unified large document operation pipeline used by both session restore and large paste/import.

### 5.1 Large operation state

Add a UI/store state shape similar to:

```ts
type LargeDocumentOperation =
  | {
      kind: 'restore' | 'import';
      phase: 'reading' | 'parsing' | 'processing' | 'hydrating' | 'indexing' | 'saving' | 'complete' | 'error';
      processed: number;
      total: number;
      message: string;
      canCancel: boolean;
    }
  | null;
```

This state should drive a visible progress overlay or progress panel.

### 5.2 Thresholds

Initial thresholds:

1. source length greater than `20_000`
2. block count greater than `100`
3. estimated serialized session size greater than `1 MB`

These should be constants, not scattered literals.

### 5.3 Worker-first processing

Create a dedicated document processing worker, for example:

1. `src/workers/documentProcessing.worker.ts`
2. `src/lib/documentProcessing/messages.ts`

The worker should handle:

1. parsing raw session JSON after main thread reads it
2. splitting large pasted text into block sources
3. creating block-like payloads in batches
4. transliterating blocks or segments where needed
5. deriving lexical usage in background batches
6. emitting progress events

Start with one worker. Do not start with a worker pool.

## 6. Saved Session Restore Plan

### Phase 1: responsive restore shell

1. Replace direct `readStoredSessionSnapshot()` plus `loadSessionSnapshot()` calls in session buttons with `restoreSessionAsync(sessionId)`.
2. On click, immediately show restore progress.
3. Main thread reads raw session string from `localStorage`.
4. Main thread sends raw string to the worker.
5. Worker parses JSON and returns:
   - session metadata
   - display settings
   - editor state
   - total block count
   - first batch of blocks
6. Main thread hydrates the workspace with a valid first batch and a restoring state.
7. Main thread appends/replaces block batches as they arrive.

### Phase 2: deferred indexes

1. Remove synchronous lexical derivation from large `loadSessionSnapshot()`.
2. For large sessions, set empty or previous-safe lexical usage initially.
3. Worker computes lexical usage after document hydration.
4. Main thread applies lexical usage once complete.

### Phase 3: autosave guard

1. Add `isRestoringSession` or equivalent guard.
2. Autosave effect must skip while restore/import is active.
3. After completion, schedule one save after a short idle delay.
4. Avoid saving if the restored snapshot is unchanged.

## 7. Large Paste/Import Plan

### Phase 1: interception

1. In `StickyTopComposer`, detect large paste by threshold.
2. Prevent default paste behavior.
3. Show import progress.
4. Send pasted text to the document processing worker.

### Phase 2: batch block creation

Worker should:

1. normalize line endings
2. split into block sources
3. process block batches
4. transliterate per block
5. post batches to the main thread

Main thread should:

1. insert the first batch quickly
2. keep active block/chunk valid
3. append later batches in controlled updates
4. defer lexical derivation
5. save once after completion

## 8. Parallelization Strategy

### Recommended first step

Use a single Web Worker.

Reasons:

1. much lower complexity than a worker pool
2. enough to move CPU-heavy work off the main thread
3. avoids excessive structured-clone overhead
4. avoids starving React of CPU
5. simpler progress, cancellation, and error handling

### Possible later worker pool

Add a worker pool only after profiling proves the single worker is too slow.

If added:

1. cap workers at `Math.min(3, navigator.hardwareConcurrency - 1)`
2. never use all cores
3. partition by blocks, not by characters
4. keep output ordering deterministic
5. throttle progress events

### Work suitable for parallel/off-main-thread processing

1. transliteration per block
2. segment creation
3. lexical usage derivation
4. exact-form usage derivation
5. import/session JSON parsing after raw string is read

### Work not suitable for worker parallelization

1. React state updates
2. DOM rendering
3. direct `localStorage` access inside the current app architecture
4. focus/selection/caret synchronization

## 9. Rendering Strategy

Even with workers, rendering can remain a bottleneck.

Recommended:

1. Keep the sticky composer focused on the active chunk only.
2. In `MainDocumentArea`, add simple block windowing for large documents.
3. Render visible blocks plus overscan, not the entire document.
4. Keep read mode line selection compatible with virtualized blocks.
5. Avoid measuring every block on every render.

Potential implementation:

1. fixed or estimated row heights initially
2. later dynamic measurement if needed
3. no dependency on a large virtualization library unless the custom version becomes fragile

## 10. Progress UI

Progress should be honest and operation-specific.

Suggested labels:

1. `Reading session`
2. `Parsing saved document`
3. `Preparing blocks`
4. `Rendering first section`
5. `Indexing suggestions`
6. `Saving restored session`

For paste/import:

1. `Reading pasted text`
2. `Splitting passages`
3. `Transliterating blocks`
4. `Updating document`
5. `Indexing suggestions`

The UI should distinguish:

1. document ready
2. indexing still running
3. save pending

## 11. Adversarial Review

### Risk: progress bar hides but does not fix freezes

Mitigation:

1. all expensive optional work must be chunked or moved to a worker
2. progress overlay must be paired with actual async processing
3. add regression checks for responsiveness where possible

### Risk: first 2000 characters load creates incomplete document semantics

Mitigation:

1. do not present partial source as complete
2. prefer full-document state with batched processing
3. if partial hydration is used, block export/copy/save until complete

### Risk: worker structured cloning becomes expensive

Mitigation:

1. send raw text once
2. send batches of blocks, not per-token events
3. avoid sending the full session repeatedly
4. throttle progress events

### Risk: autosave races with restore

Mitigation:

1. explicit `restore/import in progress` guard
2. skip autosave while guard is active
3. schedule one save after completion
4. include tests that loading a session does not immediately rewrite while incomplete

### Risk: lexical suggestions unavailable immediately

Mitigation:

1. show `Indexing suggestions...` status
2. keep direct transliteration and editing available
3. apply lexical usage when indexing completes

### Risk: rendering remains slow after worker processing

Mitigation:

1. implement document windowing after or alongside worker import
2. profile render time separately from processing time
3. add performance checks around `MainDocumentArea`

### Risk: cancellation corrupts document state

Mitigation:

1. restore/import operations should have an operation ID
2. ignore stale worker messages from previous operation IDs
3. cancellation should either restore previous state or leave a clearly marked partial import draft
4. saved-session restore should be non-cancelable after commit unless previous state snapshot is retained

### Risk: worker and main thread transliteration diverge

Mitigation:

1. worker must import the same transliteration code path
2. avoid duplicating mapping logic
3. add tests comparing worker and main-thread transliteration outputs

### Risk: localStorage remains the hard limit

Mitigation:

1. this plan improves responsiveness but does not remove localStorage size and sync-I/O limits
2. consider Dexie/IndexedDB for large sessions after worker batching
3. store sessions as block records instead of one huge JSON blob in a later phase

## 12. Implementation Milestones

### Milestone 1: instrumentation and guards

1. Add operation state.
2. Add autosave suppression during large operations.
3. Add timings around restore, parse, hydrate, render-ready, lexical indexing, and save.
4. Add thresholds for large operations.

### Milestone 2: async session restore

1. Add `restoreSessionAsync(sessionId)`.
2. Add restore progress UI.
3. Defer lexical derivation for large sessions.
4. Save once after restore completes.

### Milestone 3: worker processing

1. Add document processing worker.
2. Move large session parse/process into worker.
3. Move large paste/import processing into worker.
4. Add progress and error handling.

### Milestone 4: rendering windowing

1. Add block windowing to `MainDocumentArea`.
2. Preserve selected block scroll and click navigation.
3. Verify read/document/immersive behavior.

### Milestone 5: optional storage upgrade

1. Evaluate Dexie/IndexedDB for large sessions.
2. Store session metadata separately from block payloads.
3. Load block records incrementally.

## 13. Validation Plan

### Functional tests

1. restore small session behaves exactly as before
2. restore large session shows progress and opens correctly
3. paste large Roman text shows progress and imports all text
4. paste large Devanagari text still canonicalizes correctly
5. autosave does not run during incomplete restore/import
6. copy/export is disabled or accurate during active large operation

### Performance checks

1. 50,000-character Roman session restore
2. 100,000-character Roman session restore
3. 50,000-character paste/import
4. large read/document mode scroll
5. large session save after restore

### Regression areas

1. cursor navigation in composer preview panes
2. cursor navigation in document/read panes
3. Tamil visible text single-run rendering
4. Devanagari display invariants
5. session rename/delete/load flows

## 14. Recommendation

Implement this in the following order:

1. operation state plus progress UI
2. autosave guard
3. defer lexical derivation during large restore/import
4. single worker for large session restore and large paste/import
5. document windowing
6. IndexedDB/Dexie storage if localStorage remains a bottleneck

Do not start with "load only first 2000 characters" as the main behavior. It creates correctness risks. Prefer full-document semantics with chunked processing, deferred indexing, progress feedback, and eventually virtualized rendering.
