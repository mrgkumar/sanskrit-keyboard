# Sanskrit Keyboard Action Backlog

Date: 2026-04-15
Scope: consolidated backlog from the audit set:

1. [`01-system-audit.md`](./01-system-audit.md)
2. [`02-file-inventory.md`](./02-file-inventory.md)
3. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)
4. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)
5. [`project-context.md`](../../project-context.md)

## 0. How To Read This Backlog

Priority:

1. `P0`
   Highest-value corrective work. Reduces misinformation, stale UI, or correctness risk.
2. `P1`
   Strong structural payoff. Important, but not the first cleanup pass.
3. `P2`
   Useful follow-on work after the core backlog is stabilized.

Types:

1. `Docs`
2. `Cleanup`
3. `Refactor`
4. `Performance`
5. `Tests`
6. `Product Decision`

Status flow:

1. `not-started`
2. `started`
3. `implemented`
4. `validated`
5. `committed`
6. `done`

Proof policy:

1. Runtime source outweighs older docs and stale specs.
2. Test-file existence alone is not treated as proof.
3. Each item below is tied to a source file or audit conclusion.

Execution rule:

1. Decision items should be resolved before refactors that depend on them.
2. Test-repair items should happen before test-expansion items that build on the same surface.
3. Documentation updates should happen after the relevant runtime or decision state is settled, unless the current docs are actively misleading.

## 1. P0 Backlog

## 1.1 Reconcile Core Documentation With Actual Runtime

Type: `Docs`
Priority: `P0`
Status: `committed`

Problem:

1. README still describes Dexie-backed persistence more strongly than the current runtime supports.
2. README also implies broader OCR/export capability than the audited runtime currently exposes.

Action:

1. Update README architecture, persistence, and feature claims.
2. Remove or soften unsupported claims.
3. Update [`project-context.md`](../../project-context.md) where it is ahead of or beside the current UI.
4. Link the audit docs as the current internal source of truth.

Proof:

1. [`README.md`](../../README.md)
2. [`project-context.md`](../../project-context.md)
3. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
4. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
5. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts)

## 1.2 Repair Stale Playwright Specs Before Using Them As Proof

Type: `Tests`
Priority: `P0`
Status: `committed`

Problem:

1. Some browser specs are partially stale and currently weaken the audit’s proof quality.

Action:

1. Update selectors and flows in:
   [`session-management.spec.ts`](../../session-management.spec.ts)
   [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
2. Reclassify them as current proof only after they match runtime markup and behavior.
3. Update [`04-feature-test-coverage.md`](./04-feature-test-coverage.md) after revalidation so the audit stays aligned.

Proof:

1. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)
2. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
3. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)

## 1.3 Decide the Fate of `/reference`

Type: `Product Decision`
Priority: `P0`
Status: `validated`

Problem:

1. `/reference` needs to be treated as a reference browser, not as a transcription workspace.

Action:

1. Reduce the route to an honest reference browser instead of a fake transcription workspace.
2. Remove empty-workspace and assignment-oriented language from the route.
3. Keep it as a study surface reachable from settings, not as a primary editor.

Dependency:

1. Resolve this before investing in route-specific tests or refactors for `/reference`.

Proof:

1. [`src/app/reference/page.tsx`](../../src/app/reference/page.tsx)
2. [`src/components/reference/VedicReferencePane.tsx`](../../src/components/reference/VedicReferencePane.tsx)

## 1.4 Decide the Fate of Mapping Customization UI

Type: `Product Decision`
Priority: `P0`
Status: `not-started`

Problem:

1. Mapping settings imply editable customization, but the workflow is not actually implemented.
2. `Reset to Default` is a no-op.

Action:

1. Either implement true mapping customization.
2. Or downgrade the route to read-only reference/documentation.
3. Remove fake edit/reset affordances if feature work is not planned.

Dependency:

1. Resolve this before adding tests or deeper UX polish for mapping customization.

Proof:

1. [`src/app/settings/mappings/page.tsx`](../../src/app/settings/mappings/page.tsx)
2. [`src/components/settings/MappingManager.tsx`](../../src/components/settings/MappingManager.tsx)

## 1.5 Remove or Archive Dead Modules

Type: `Cleanup`
Priority: `P0`
Status: `not-started`

Candidates:

1. [`src/components/audit/UnicodeInspector.tsx`](../../src/components/audit/UnicodeInspector.tsx)
2. [`src/hooks/useSyncScroll.ts`](../../src/hooks/useSyncScroll.ts)
3. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts)
4. [`src/lib/vedic/export.ts`](../../src/lib/vedic/export.ts)
5. [`src/lib/utils.ts`](../../src/lib/utils.ts)

Action:

1. Remove dead files if they are not planned.
2. Otherwise move them into an explicit experimental/archive area and label them clearly.

Dependency:

1. Do this before large refactors so dead modules do not distort the new structure.

Proof:

1. [`01-system-audit.md`](./01-system-audit.md)
2. [`02-file-inventory.md`](./02-file-inventory.md)

## 1.6 Fix Naming Drift Between `Sanskirt` and `Sanskrit`

Type: `Cleanup`
Priority: `P0`
Status: `not-started`

Problem:

1. Persistent keys and some copy still use `Sanskirt`.

Action:

1. Introduce compatibility migration for old keys.
2. Standardize naming in storage keys, comments, and user-facing copy.

Dependency:

1. Do this before expanding onboarding/session tests so new test fixtures target the stable key set.

Proof:

1. [`src/app/page.tsx`](../../src/app/page.tsx)
2. [`src/app/welcome/page.tsx`](../../src/app/welcome/page.tsx)

## 1.7 Add Direct Store Tests For Block Operations

Type: `Tests`
Priority: `P0`
Status: `not-started`

Problem:

1. Several core editor behaviors exist in the store, but do not have strong direct unit tests.

Action:

1. Add tests for:
   `splitBlock`
   `mergeBlocks`
   `deleteBlock`
   `restoreDeletedBlock`
   `addBlocks`

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 1.8 Add Direct Tests For Session Orchestration

Type: `Tests`
Priority: `P0`
Status: `not-started`

Problem:

1. Session behavior is product-critical, but key store-level operations do not have strong direct tests.

Action:

1. Add direct tests for:
   `markSessionSaved`
   `deleteSession`
   `renameSession`
   `resetSession`
   `loadSessionSnapshot`

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 1.9 Add Direct Segmentation Policy Tests

Type: `Tests`
Priority: `P0`
Status: `not-started`

Problem:

1. Long-block segmentation is core product behavior but lacks direct unit coverage.

Action:

1. Add focused tests for threshold behavior, offsets, chunk boundaries, and stability after edits.

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 2. P1 Backlog

## 2.1 Split `useFlowStore.ts`

Type: `Refactor`
Priority: `P1`
Status: `not-started`

Problem:

1. The store mixes document model logic, segmentation, session orchestration, display settings, migrations, and lexical learning.

Action:

1. Extract modules such as:
   `session`
   `displaySettings`
   `blockEditing`
   `segmentation`
   `lexicalLearning`

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 2.2 Split `StickyTopComposer.tsx`

Type: `Refactor`
Priority: `P1`
Status: `not-started`

Problem:

1. The composer file owns too many responsibilities and is one of the main complexity hotspots.

Action:

1. Extract toolbar, input pane, preview pane, compare pane, copy actions, and prediction popup concerns into smaller components.

Proof:

1. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 2.3 Split `TransliterationEngine.tsx`

Type: `Refactor`
Priority: `P1`
Status: `not-started`

Problem:

1. Engine shell mixes autosave, migration, lexical persistence, workspace tabs, and utility UI.

Action:

1. Extract workspace tabs and side effects into dedicated components/hooks.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 2.4 Narrow Large Zustand Subscriptions

Type: `Performance`
Priority: `P1`
Status: `not-started`

Problem:

1. The largest components subscribe broadly to store state, increasing rerender risk.

Action:

1. Replace broad subscriptions with focused selectors.
2. Keep volatile state local where possible.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)
3. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)

## 2.5 Memoize Expensive Derived Rendering Paths

Type: `Performance`
Priority: `P1`
Status: `not-started`

Problem:

1. Preview and document surfaces recompute transliteration and formatting work repeatedly.

Action:

1. Memoize preview models by source and output settings.
2. Cache per-block formatted output where it materially reduces rerender cost.

Proof:

1. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)
2. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
3. [`src/lib/vedic/utils.ts`](../../src/lib/vedic/utils.ts)

## 2.6 Add Current UI Tests For Session Workflows

Type: `Tests`
Priority: `P1`
Status: `not-started`

Problem:

1. Rename/delete/search session coverage is currently weak because the existing spec is stale.

Action:

1. Write or repair tests against current selectors and actual drawer behavior.

Proof:

1. [`session-management.spec.ts`](../../session-management.spec.ts)
2. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)

## 2.7 Add Direct Tests For Reference State Logic

Type: `Tests`
Priority: `P1`
Status: `not-started`

Problem:

1. Reference usage and category toggle state affect UX but are not directly covered.

Action:

1. Add tests for `incrementReferenceUsage` and `toggleReferenceCategory`.

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 2.8 Add Current UI Tests For Lexical Reset/Purge Controls

Type: `Tests`
Priority: `P1`
Status: `not-started`

Problem:

1. Reset and purge behaviors exist in runtime, but current proof is partially stale.

Action:

1. Add UI coverage for:
   adaptive prediction toggle
   session learning reset
   global history purge

Proof:

1. [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
2. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)

## 2.9 Add Tests For Onboarding and Mobile Warning

Type: `Tests`
Priority: `P1`
Status: `not-started`

Problem:

1. Route-level first-visit gating and mobile warning behavior are not directly covered.

Action:

1. Add route/UI tests for onboarding redirect.
2. Add UI tests for the mobile optimization notice.

Proof:

1. [`src/app/page.tsx`](../../src/app/page.tsx)
2. [`src/app/welcome/page.tsx`](../../src/app/welcome/page.tsx)
3. [`src/components/MobileOptimizationNotice.tsx`](../../src/components/MobileOptimizationNotice.tsx)

## 2.10 Add Direct Tests For Autosave Timing and Persistence Boundaries

Type: `Tests`
Priority: `P1`
Status: `not-started`

Problem:

1. Autosave exists and matters, but current proof is indirect and timing behavior is not pinned down.

Action:

1. Add tests for debounce/timer behavior.
2. Add tests for write boundaries so unchanged state does not cause unnecessary persistence writes.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 2.11 Separate Harvesting Jobs From Regression Specs

Type: `Cleanup`
Priority: `P1`
Status: `not-started`

Problem:

1. Several operational jobs are named and organized like Playwright regression tests.

Action:

1. Move harvesting jobs into `scripts/` or a dedicated tools folder.
2. Keep user-facing regression tests separate from data jobs.

Proof:

1. [`scrape_links.spec.ts`](../../scrape_links.spec.ts)
2. [`harvest_shiva_words.spec.ts`](../../harvest_shiva_words.spec.ts)
3. [`harvest_combined_words.spec.ts`](../../harvest_combined_words.spec.ts)

## 2.12 Isolate Autosave Into A Dedicated Hook

Type: `Refactor`
Priority: `P1`
Status: `not-started`

Problem:

1. Autosave exists, but timing and persistence orchestration are mixed into the engine shell.

Action:

1. Extract `useAutosave`.
2. Clarify debounce/write policy.
3. Add targeted tests once extracted.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`04-feature-test-coverage.md`](./04-feature-test-coverage.md)

## 2.13 Centralize Segmentation Rules

Type: `Refactor`
Priority: `P1`
Status: `not-started`

Problem:

1. Segmentation thresholds are implementation detail instead of an explicit policy surface.

Action:

1. Extract a segmentation policy module.
2. Make thresholds explicit and testable.

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 3. P2 Backlog

## 3.1 Decide Whether To Expose or Remove `focus` Mode

Type: `Product Decision`
Priority: `P2`
Status: `not-started`

Problem:

1. `focus` mode exists in types and rendering logic, but appears unreachable from current UI.

Action:

1. Either expose it intentionally.
2. Or remove the latent mode.

Proof:

1. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
2. [`src/store/types.ts`](../../src/store/types.ts)

## 3.2 Decide Whether Roman Should Be A User-Facing Primary Script Option

Type: `Product Decision`
Priority: `P2`
Status: `not-started`

Problem:

1. Roman is supported in formatting/state logic but not exposed as a main primary-script option in the current workspace settings.

Action:

1. Either expose Roman intentionally.
2. Or keep it internal and simplify the mental model.

Proof:

1. [`src/lib/vedic/mapping.ts`](../../src/lib/vedic/mapping.ts)
2. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)

## 3.3 Virtualize Long Read Surfaces If Profiling Demands It

Type: `Performance`
Priority: `P2`
Status: `not-started`

Problem:

1. Read/document/immersive surfaces render directly and may not scale well for very large sessions.

Action:

1. Profile first.
2. Add windowing only if large real-world sessions justify the complexity.

Proof:

1. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 3.4 Reduce Full Re-segmentation On Long-Block Edits If It Becomes Hot

Type: `Performance`
Priority: `P2`
Status: `not-started`

Problem:

1. Full-block reconstruction is simple and safe, but may scale poorly for large blocks.

Action:

1. Keep current implementation unless profiling shows it is hot.
2. Consider incremental re-segmentation near the edit span if needed.

Proof:

1. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
2. [`03-improvement-opportunities.md`](./03-improvement-opportunities.md)

## 3.5 Lazy-Load Rare Utilities and Secondary Panels

Type: `Performance`
Priority: `P2`
Status: `not-started`

Problem:

1. Secondary panels and utilities do not need to be part of the cheapest initial typing path.

Action:

1. Lazy-load utility-heavy secondary surfaces if bundle pressure or startup cost warrants it.

Proof:

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
2. [`src/components/engine/TamilPrecisionRecovery.tsx`](../../src/components/engine/TamilPrecisionRecovery.tsx)

## 3.6 Consolidate Imperative DOM Query and Focus-Restore Patterns

Type: `Refactor`
Priority: `P2`
Status: `not-started`

Problem:

1. Several components use `document.querySelector` and timing-based focus restoration.

Action:

1. Replace with ref-driven targeting where practical.
2. Centralize unavoidable imperative logic in one helper/hook.

Proof:

1. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
2. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)

## 4. Suggested Execution Order

## Phase 1

1. Reconcile README.
2. Reconcile `project-context.md`.
3. Repair stale Playwright specs.
4. Decide fate of `/reference`.
5. Decide fate of mapping customization UI.
6. Remove/archive dead modules.
7. Fix naming drift.

## Phase 2

1. Add block-operation tests.
2. Add session-orchestration tests.
3. Add segmentation tests.
4. Add current session/lexical/onboarding/mobile tests.
5. Add autosave timing tests.
6. Separate harvesting jobs from regression specs.

## Phase 3

1. Split `useFlowStore.ts`.
2. Split `StickyTopComposer.tsx`.
3. Split `TransliterationEngine.tsx`.
4. Extract autosave and segmentation-policy modules.

## Phase 4

1. Narrow store subscriptions.
2. Memoize derived rendering.
3. Profile long-session performance.
4. Decide whether virtualization or incremental re-segmentation is justified.

## 5. Highest-Value First Slice

If only a small first pass is funded, this is the best sequence:

1. Fix documentation drift.
2. Repair stale specs.
3. Remove dead and misleading surfaces.
4. Add direct tests for block operations, sessions, and segmentation.
5. Then start structural refactors.
