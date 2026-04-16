# Sanskrit Keyboard System Audit

Date: 2026-04-15
Scope: `app/` repository, with priority on shipped runtime code in `src/`, the active test suite, and supporting build/data scripts.

## 0. Method And Proof Standard

This document was refined against current runtime source, not only against prior summaries.

Evidence hierarchy used here:

1. Runtime source proof
   A behavior is directly implemented in `src/`.
2. Test proof
   A behavior is explicitly asserted in a current-looking test.
3. Weak test proof
   A behavior is mentioned by a test, but the spec appears stale or references selectors not present in current runtime code.
4. Inference
   A conclusion derived from several code signals rather than one explicit assertion.

Important caveat:

1. The repo has a broad test suite, but not every UI spec appears current.
2. Some Playwright specs reference selectors not found in the current runtime markup.
3. Because of that, runtime source files are treated as the primary proof source for product behavior.

## 1. Executive Summary

Sanskrit Keyboard is a client-heavy scholarly transliteration workspace built around one core promise:

1. Enter Sanskrit in ITRANS.
2. Keep the editable source canonical.
3. Render that source immediately into Devanagari, Tamil precision, or Roman output.
4. Support long-form editing through blocks, chunks, sessions, and read/review modes instead of a single large editor.

The real architectural center is [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts). The UI is mostly a shell around that store plus the transliteration contract in [`src/lib/vedic/mapping.ts`](../../src/lib/vedic/mapping.ts) and [`src/lib/vedic/utils.ts`](../../src/lib/vedic/utils.ts).

The project is materially more mature than some of its secondary routes and documentation. The main workspace is real and substantially implemented. The test suite is broad, but not uniformly current; some UI specs appear stale. Several secondary modules are either orphaned, only partially wired, or still describing capabilities that are not actually implemented.

## 2. Product Intent

The app is not a general rich-text editor. It is a specialized transliteration workstation with these design priorities:

1. Preserve canonical source input.
2. Make script rendering trustworthy enough for scholarly work.
3. Keep typing uninterrupted with predictions, references, and copy actions close to the composer.
4. Scale from short mantra entry to longer passage work through block segmentation.
5. Separate editing from reading, rather than forcing both into one surface.

## 3. Actual Runtime Architecture

## 3.1 Entry Flow

1. [`src/app/page.tsx`](../../src/app/page.tsx) is the primary route.
2. First visit is gated by a `localStorage` flag and redirected to `/welcome`.
3. Returning users see [`SessionLanding`](../../src/components/engine/SessionLanding.tsx) before entering the workspace.
4. The real app shell is [`TransliterationEngine`](../../src/components/engine/TransliterationEngine.tsx), dynamically imported client-side.

Proof:

1. [`src/app/page.tsx`](../../src/app/page.tsx)
2. [`src/components/engine/SessionLanding.tsx`](../../src/components/engine/SessionLanding.tsx)

## 3.2 Main Runtime Surfaces

1. `TransliterationEngine`
   Responsibility: global workspace shell, left workspace drawer, autosave, lexical-learning persistence, view-mode controls, whole-document copy actions, Tamil recovery utility.
2. `StickyTopComposer`
   Responsibility: active chunk editing, live previews, block/chunk navigation, compare mode, copy actions, prediction popup, reference-panel entry point.
3. `MainDocumentArea`
   Responsibility: lower reading surface for `document`, `read`, `review`, `focus`, and `immersive` modes.
4. `ReferenceSidePanel` + `ReferenceLibrary`
   Responsibility: searchable mapping/reference insertion into the active chunk.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)
3. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
4. [`src/components/ReferenceSidePanel.tsx`](../../src/components/ReferenceSidePanel.tsx)
5. [`src/components/reference/ReferenceLibrary.tsx`](../../src/components/reference/ReferenceLibrary.tsx)

## 3.3 Core State Model

[`src/store/types.ts`](../../src/store/types.ts) and [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts) define the model:

1. `CanonicalBlock`
   The persistent document unit.
2. `Segment`
   Internal subdivision of long blocks.
3. `ChunkGroup`
   The currently editable subset of a block.
4. `EditorState`
   Active block, active anchor segment, focus span, and view mode.
5. `DisplaySettings`
   Input scheme, output targets, typography, fonts, prediction layout, and reference preferences.

Important implementation note: the app stores canonical ITRANS and derives rendered output from it. Rendered text is never the source of truth.

Proof:

1. [`src/store/types.ts`](../../src/store/types.ts)
2. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)

## 3.4 Transliteration Pipeline

1. [`src/lib/vedic/mapping.ts`](../../src/lib/vedic/mapping.ts)
   Canonical mapping tables, alias handling, input schemes, output-target settings, accepted-input canonicalization.
2. [`src/lib/vedic/utils.ts`](../../src/lib/vedic/utils.ts)
   Forward transliteration, reverse transliteration, Tamil precision formatting and reversal, Devanagari normalization, copy formatting, paste canonicalization.
3. [`src/components/ScriptText.tsx`](../../src/components/ScriptText.tsx)
   Final display normalization and font-preset-aware rendering.

The transliteration engine is greedy and longest-match based. It also maintains source-to-target and target-to-source maps so clicks in rendered text can jump back to source positions.

## 3.5 Prediction Pipeline

1. [`src/lib/vedic/runtimeLexicon.ts`](../../src/lib/vedic/runtimeLexicon.ts)
   Loads sharded prefix lexicons from static assets, merges corpus counts with session/user usage, and applies learned swara variants.
2. [`src/lib/vedic/lexicalNormalization.ts`](../../src/lib/vedic/lexicalNormalization.ts)
   Canonicalizes lexical forms and strips svara markers for lookup.
3. UI surfaces:
   [`WordPredictionTray`](../../src/components/engine/WordPredictionTray.tsx) and [`ShortcutHUD`](../../src/components/engine/ShortcutHUD.tsx).

## 3.6 Persistence Model

There are two persistence layers in actual runtime:

1. Session snapshots in `localStorage`
   Current implementation of saved sessions.
2. Lexical learning in `localStorage`
   Separate persisted usage history for autocomplete.

Despite Dexie being listed as a dependency, active runtime persistence is localStorage-based, not IndexedDB-based.

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
3. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts)

## 4. Functional Requirements Extracted From Code

## 4.1 Input and Editing

1. Users type canonical or Baraha-compatible ITRANS into the sticky composer.
2. Composer supports multiline entry.
3. `Enter` adds a newline inside the current editable chunk.
4. `Shift+Enter` splits the current block when in `read` or `document` mode.
5. Pasting Devanagari is supported via detransliteration back into canonical ITRANS.
6. Alias input may stay raw while typing and canonicalize on commit boundaries.
7. Visarga-plus-svara marker ordering can auto-correct during editing.
8. Long blocks auto-segment unless block creation explicitly disables auto-segmentation.

## 4.2 Block and Chunk Workflow

1. The document is block-based, not one continuous string.
2. Long blocks are split into segments and edited chunk-by-chunk.
3. Users can move between chunks and between blocks.
4. Blocks can be merged with previous or next blocks.
5. Blocks can be deleted and briefly restored through an undo toast.
6. A blank document state is represented as a single empty block.

## 4.3 Rendering and Output Targets

1. Primary output script is stateful and drives major read surfaces.
2. Comparison output is optional and limited to the top composer.
3. Roman output supports canonical and Baraha styles.
4. Tamil output currently exposes only `precision`.
5. Devanagari display is font-aware and applies compatibility normalization for some fonts.
6. Tamil precision display applies visual normalization rules for accents, nasalization, and superscript ordering.

## 4.4 Reading and Navigation

1. `document` mode shows a document canvas with block-level browsing.
2. `read` mode shows line-oriented rendered reading.
3. `immersive` mode is a full-height reading variant.
4. Clicking a read line jumps back into edit/review context.
5. In immersive mode, single click selects a line and double click returns to `read`.
6. `review` mode exposes source/rendered segment inspection for the active block.

## 4.5 Reference and Assistance

1. Searchable reference mappings can be inserted into the active chunk.
2. Reference cards track usage to build quick-access shortcuts.
3. Join controls `^z` and `^Z` are explicitly surfaced.
4. Character-level suggestions and phonetic alternatives remain visible in the HUD.
5. Word-level predictions support inline, split, footer, and listbox layouts.

## 4.6 Session Management

1. Users can create a new session.
2. Users can resume the latest session.
3. Users can rename or delete saved sessions.
4. Sessions autosave on a timer.
5. Legacy v1 sessions are migrated to the v2 snapshot/index format.

## 4.7 Utilities

1. Whole-document copy is available for explicit scripts.
2. Tamil Precision Recovery accepts Tamil precision input only and refuses to guess on plain Tamil or mixed input.
3. Local lexical learning can be reset for the session or globally purged.

## 5. Non-Functional Requirements Extracted From Code

## 5.1 Precision and Determinism

1. Transliteration correctness is treated as a contract.
2. Longest-match tokenization and explicit alias canonicalization are central design assumptions.
3. Tamil reverse conversion is intentionally conservative and bounded.
4. Font-specific display normalization exists to avoid scholarly glyph regressions.

## 5.2 Performance

1. Main engine is dynamically imported with a skeleton loader.
2. Transliteration results are cached.
3. Runtime lexicon loads in shards instead of one monolith.
4. Read and immersive views avoid showing empty rendered blocks.

## 5.3 Local-First Behavior

1. Sessions live only in browser storage.
2. Lexical learning is local to the browser unless manually exported by future work.
3. The app does not currently depend on a backend.

## 5.4 Testability

1. The app includes a broad Playwright suite plus logic-heavy specs.
2. Data pipeline and prediction generation also have script-level validation paths.
3. Runtime surfaces include many `data-testid` hooks, indicating UI behavior is intended to be testable.
4. Test freshness is uneven: some Playwright specs appear current, while others reference selectors not present in the current runtime.

## 5.5 Deployment Constraints

1. The app is designed to support static hosting and GitHub Pages deployment.
2. Autocomplete assets are copied into deployable output during `predev` and `prebuild`.

## 5.6 UX Constraints

1. Desktop-first layout is intentional.
2. Mobile is not blocked, but it is explicitly warned against.
3. Typography and preview sizes are user-adjustable rather than hard-coded.

## 6. Design System and UX Structure

## 6.1 Main Design Pattern

The strongest design decision is the split between:

1. Sticky top editing/comparison surface.
2. Lower reading/review/document surface.

That split appears throughout the store, layout, copy actions, and test suite.

## 6.2 Visual Language

1. Blue is the primary interaction color.
2. White and slate surfaces dominate workspace screens.
3. Rounded panels and soft shadows are used consistently.
4. Script rendering is font-preset-driven rather than browser-default-driven.

## 6.3 Interaction Model

1. Fast direct manipulation over modal workflows.
2. Keyboard-first editing with assisted navigation.
3. Hidden complexity in the store, relatively lightweight direct controls in the UI.

## 7. Gaps, Stale Areas, and Dead Code

Status labels:

1. Dead
   No runtime references found.
2. Latent
   Code exists but is not reachable from normal UI.
3. Partial
   UI exists, but behavior is stubbed or misleading.

### Dead

1. [`src/components/audit/UnicodeInspector.tsx`](../../src/components/audit/UnicodeInspector.tsx)
   No runtime or test references.
2. [`src/hooks/useSyncScroll.ts`](../../src/hooks/useSyncScroll.ts)
   Not imported anywhere.
3. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts)
   Dexie wrapper is unused.
4. [`src/lib/vedic/export.ts`](../../src/lib/vedic/export.ts)
   Export helper is unused.
5. [`src/lib/utils.ts`](../../src/lib/utils.ts)
   `cn()` helper exists but the codebase imports `clsx` directly instead.

Proof:

1. No active runtime imports were found for these modules during the audit pass.

### Latent

1. `viewMode: 'focus'`
   Implemented in [`MainDocumentArea`](../../src/components/MainDocumentArea.tsx) and store types, but there is no visible runtime control to enter it from the current workspace shell.
2. Roman as primary output script
   Store and formatting code support it, but current workspace UI exposes Devanagari and Tamil as the user-facing primary script controls.

### Partial or Misleading

1. [`src/app/reference/page.tsx`](../../src/app/reference/page.tsx)
   Dedicated reference browser page. The earlier empty-workspace / assignment framing was misleading and has been reduced to a study/reference surface.
2. [`src/components/reference/VedicReferencePane.tsx`](../../src/components/reference/VedicReferencePane.tsx)
   Used as the static study pane on the `/reference` route, not by the main workspace.
3. [`src/components/settings/MappingManager.tsx`](../../src/components/settings/MappingManager.tsx)
   Presents editing affordances and claims custom mapping override behavior, but no mapping-edit workflow is actually wired.
4. [`src/app/settings/mappings/page.tsx`](../../src/app/settings/mappings/page.tsx)
   "Reset to Default" is a no-op button.
5. [`README.md`](../../README.md)
   Claims Dexie persistence and an OCR fix mode, neither of which reflects the current runtime accurately.

Proof:

1. [`src/app/reference/page.tsx`](../../src/app/reference/page.tsx)
2. [`src/components/reference/VedicReferencePane.tsx`](../../src/components/reference/VedicReferencePane.tsx)
3. [`src/components/settings/MappingManager.tsx`](../../src/components/settings/MappingManager.tsx)
4. [`src/app/settings/mappings/page.tsx`](../../src/app/settings/mappings/page.tsx)
5. [`README.md`](../../README.md)

## 8. Documentation Drift and Inconsistencies

1. [`project-context.md`](../../project-context.md) is broadly useful but slightly ahead of or beside the current UI in a few places.
2. [`README.md`](../../README.md) is more marketing-oriented than code-accurate.
3. The app name is inconsistently spelled as `Sanskirt Keyboard` in several localStorage keys and visible strings.

## 9. Validation Notes

I ran `npm run lint`.

Result:

1. App runtime source was not the failure source.
2. Lint currently fails because [`debug-corpus.js`](../../debug-corpus.js) uses `require()` in a repo configured against that style.
3. Some UI spec files appear stale because they reference selectors not present in current runtime code.
4. This affects how strongly test files can be used as proof in the other audit documents.

## 10. Recommended Cleanup Order

1. Decide whether the `/reference` study page and `VedicReferencePane` should remain separate from the main workspace.
2. Either wire real mapping customization or remove the fake edit/reset affordances.
3. Remove or archive dead modules: `UnicodeInspector`, `useSyncScroll`, `db.ts`, `export.ts`, `lib/utils.ts`.
4. Reconcile README claims with current implementation.
5. Decide whether `focus` mode and primary Roman output should be exposed or deleted.
6. Normalize the `Sanskirt` vs `Sanskrit` naming drift before more persistence keys accumulate.

## 11. Remaining Uncertainty

These points were intentionally not overstated:

1. Session-management UI tests exist, but at least some selectors in [`session-management.spec.ts`](../../session-management.spec.ts) do not match current runtime markup.
2. Paste-normalization UI tests exist, but [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts) also appears to reference missing selectors.
3. Because of that, runtime source is a stronger proof source than the UI suite for several workflow claims.

Concrete examples:

1. [`session-management.spec.ts`](../../session-management.spec.ts) references `workspace-sidebar` and `session-rename-input`, while current runtime exposes [`workspace-panel`](../../src/components/engine/TransliterationEngine.tsx) and an inline rename input with no test id.
2. [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts) references `workspace-sidebar` and `display-settings-toggle`, while the current workspace uses tab buttons such as [`workspace-tab-display`](../../src/components/engine/TransliterationEngine.tsx).
3. [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) references `swara-prediction-toggle` and `clear-session-learning`, while current runtime exposes the same behaviors without those test ids.
