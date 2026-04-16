# Sanskrit Keyboard Improvement Opportunities

Date: 2026-04-15
Scope: cleanup, refactor, and performance opportunities identified from the current `app/` codebase.

## 0. Proof Standard

The opportunities in this document are source-backed. Each recommendation was based on at least one of:

1. direct runtime source inspection
2. missing imports or orphaned files
3. mismatches between runtime code and existing docs/tests
4. oversized files with mixed responsibilities

Proof discipline used in this refined pass:

1. Runtime source outweighs prior audit wording.
2. A test file is not treated as strong evidence if it references selectors missing from current source.
3. Where evidence is incomplete, recommendations are framed as cleanup or revalidation work, not as settled defects.

## 1. Prioritization Framework

I am splitting opportunities into three groups:

1. Cleanup
   Remove drift, dead code, misleading UI, and stale abstractions.
2. Refactor
   Improve structure without changing product scope.
3. Performance
   Reduce render cost, state churn, bundle weight, and interaction latency.

Priority levels:

1. P0
   High-value, low-risk, or correctness-adjacent.
2. P1
   Strong engineering payoff, moderate scope.
3. P2
   Useful, but secondary to the current core workflow.

## 2. Cleanup Opportunities

## 2.1 Remove or Archive Dead Modules

Priority: P0

Candidates:

1. [UnicodeInspector.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/audit/UnicodeInspector.tsx)
2. [useSyncScroll.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/hooks/useSyncScroll.ts)
3. [db.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/lib/vedic/db.ts)
4. [export.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/lib/vedic/export.ts)
5. [utils.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/lib/utils.ts)

Why:

1. They add maintenance surface without proven runtime value.
2. They create false signals about architecture, especially `db.ts` and `export.ts`.
3. They make future contributors assume capabilities that do not exist.

Suggested action:

1. Remove if not planned.
2. Otherwise move to an `archive/experimental` or `src/experimental` area with explicit status notes.

Evidence:

1. No active runtime imports were found for these modules.
2. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts) is especially misleading because Dexie is present in dependencies but not used in active persistence.

## 2.2 Reconcile Misleading Secondary Routes

Priority: P0

Candidates:

1. [reference/page.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/app/reference/page.tsx)
2. [VedicReferencePane.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/reference/VedicReferencePane.tsx)
3. [settings/mappings/page.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/app/settings/mappings/page.tsx)
4. [MappingManager.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/settings/MappingManager.tsx)

Why:

1. `/reference` was shaped like a transcription workflow but now needs to read as a reference browser.
2. Mapping settings now need to read as a reference library rather than a customization tool.
3. Any future edit/reset behavior should be explicitly implemented instead of implied.

Suggested action:

1. Keep the screens read-only unless mapping customization is explicitly shipped.
2. Add customization only with real persistence, migration, and tests.

Evidence:

1. [`src/app/reference/page.tsx`](../../src/app/reference/page.tsx) now renders a reference browser rather than an empty workspace.
2. [`src/components/settings/MappingManager.tsx`](../../src/components/settings/MappingManager.tsx) is now read-only, matching the current runtime.

## 2.3 Remove Naming Drift

Priority: P0

Example:

1. `sanskirt-keyboard-visited` in [page.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/app/page.tsx) and [welcome/page.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/app/welcome/page.tsx)

Why:

1. Typos in persistent keys become long-lived compatibility baggage.
2. The project name is inconsistently presented to users and future maintainers.

Suggested action:

1. Introduce a migration path from `sanskirt-*` to `sanskrit-*`.
2. Standardize naming in UI copy and comments at the same time.

Evidence:

1. [`src/app/page.tsx`](../../src/app/page.tsx)
2. [`src/app/welcome/page.tsx`](../../src/app/welcome/page.tsx)

## 2.4 Clean Up Documentation Drift

Priority: P0

Files:

1. [README.md](/home/ganesh/Documents/Research/sanskrit_keyboard/app/README.md)
2. [project-context.md](/home/ganesh/Documents/Research/sanskrit_keyboard/app/project-context.md)

Why:

1. README still implies Dexie-backed persistence.
2. README mentions OCR-fix/export capability more strongly than the actual runtime supports.
3. The new audit docs should become the current internal truth source.

Suggested action:

1. Align README with current runtime.
2. Link the audit docs from README or AGENTS guidance.

Evidence:

1. [`README.md`](../../README.md) still describes Dexie persistence.
2. Active persistence behavior lives in [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts) and [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx).

## 2.5 Separate Operational Scripts From User Regression Tests

Priority: P1

Files:

1. [scrape_links.spec.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/scrape_links.spec.ts)
2. [harvest_shiva_words.spec.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/harvest_shiva_words.spec.ts)
3. [harvest_combined_words.spec.ts](/home/ganesh/Documents/Research/sanskrit_keyboard/app/harvest_combined_words.spec.ts)

Why:

1. These are harvesting jobs, not product regression tests.
2. Keeping them in Playwright spec naming makes test intent ambiguous.

Suggested action:

1. Move them into `scripts/` or `tools/harvest/`.
2. Keep pure regression specs in Playwright test discovery.

Evidence:

1. These files perform content harvesting rather than asserting UI behavior.

## 3. Refactor Opportunities

## 3.1 Split `useFlowStore.ts`

Priority: P0

Current issue:

[`useFlowStore.ts`](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/store/useFlowStore.ts) is the core asset in the repo, but it is too large and mixes too many concerns:

1. document model creation
2. segmentation logic
3. block editing operations
4. lexical learning and ranking state
5. display settings normalization
6. session persistence
7. migration logic

Suggested extraction:

1. `store/session.ts`
2. `store/displaySettings.ts`
3. `store/blockEditing.ts`
4. `store/lexicalLearning.ts`
5. `store/segmentation.ts`

Expected payoff:

1. Lower regression risk.
2. Better testability for pure logic.
3. Easier reasoning about state changes.

## 3.2 Split `StickyTopComposer.tsx`

Priority: P0

Current issue:

[`StickyTopComposer.tsx`](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/StickyTopComposer.tsx) is the biggest UI file and currently owns:

1. input handling
2. copy behavior
3. quick switch menus
4. preview rendering
5. scroll sync
6. pointer selection logic
7. resize logic
8. prediction popup positioning
9. deleted-block toast

Suggested extraction:

1. `ComposerToolbar`
2. `ComposerInputPane`
3. `ComposerPreviewPane`
4. `ComposerComparePane`
5. `ComposerPredictionPopup`
6. `ComposerCopyActions`

Expected payoff:

1. Much smaller render surface.
2. More focused regression tests.
3. Less coupling between selection logic and UI chrome.

## 3.3 Split `TransliterationEngine.tsx`

Priority: P1

Current issue:

[`TransliterationEngine.tsx`](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/engine/TransliterationEngine.tsx) combines:

1. migration logic
2. autosave wiring
3. lexical persistence hydration
4. workspace drawer
5. session UI
6. display settings UI
7. intelligence UI
8. utility UI
9. info/resources UI

Suggested extraction:

1. `WorkspacePanel`
2. `SessionsTab`
3. `DisplayTab`
4. `IntelligenceTab`
5. `UtilityTab`
6. `InfoTab`
7. `useSessionMigration`
8. `useAutosave`
9. `useLexicalPersistence`

## 3.4 Centralize Block Segmentation Rules

Priority: P1

Current issue:

Segmentation logic is embedded directly in the store and tuned with heuristic thresholds.

Why refactor:

1. Segmentation is core product behavior.
2. Thresholds like length > 50 and long-block heuristics should be explicit policy, not hidden implementation detail.

Suggested action:

1. Extract a `segmentationPolicy.ts`.
2. Add targeted tests for chunk boundaries and offsets.

## 3.5 Make Output-Target State the Only Public Model

Priority: P1

Current issue:

The app carries both new output-target fields and a legacy `outputScheme` bridge.

Why:

1. The bridge is useful for migration.
2. But it should remain a compatibility layer, not a first-class mental model.

Suggested action:

1. Move all bridge logic behind a migration/serialization boundary.
2. Stop surfacing legacy names in active code paths where possible.

## 3.6 Introduce Explicit Feature Status for Experimental Utilities

Priority: P1

Current issue:

The codebase contains bounded utilities and partial screens, but status is implicit.

Suggested action:

1. Add a tiny `featureStatus.ts` registry or route-level metadata.
2. Mark routes/components as `stable`, `bounded`, `experimental`, or `legacy`.

This would reduce future drift.

## 4. Performance Improvement Opportunities

## 4.1 Avoid Broad Store Subscriptions in Large Components

Priority: P0

Current issue:

Major components call `useFlowStore()` broadly and receive large state bundles:

1. [TransliterationEngine.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/engine/TransliterationEngine.tsx)
2. [StickyTopComposer.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/StickyTopComposer.tsx)
3. [MainDocumentArea.tsx](/home/ganesh/Documents/Research/sanskrit_keyboard/app/src/components/MainDocumentArea.tsx)

Why it matters:

1. Any store update can trigger large component rerenders.
2. Typing performance risk rises as features accumulate.

Suggested action:

1. Switch to narrower selectors.
2. Split components so volatile state stays local.
3. Prefer derived selectors for blocks, active chunk, and display settings slices.

## 4.2 Memoize Expensive Derived Rendering

Priority: P0

Hot spots:

1. repeated `transliterate()` calls during render
2. repeated `formatSourceForScript()` calls for the same chunk
3. preview word-range generation in composer
4. read-mode rendering across all blocks

Suggested action:

1. Memoize formatted preview values by `currentChunkSource` plus output settings.
2. Memoize per-block rendered script output in document surfaces.
3. Consider caching `formatSourceForScript()` for common combinations.

## 4.3 Reduce Full-Block Re-segmentation on Every Chunk Edit

Priority: P1

Current issue:

For long blocks, chunk edits reconstruct the full block and regenerate all segments.

Why it matters:

1. It is simple and safe.
2. But it scales poorly for large blocks.

Suggested action:

1. Keep the current behavior until profiling proves it is a bottleneck.
2. If it becomes hot, implement incremental re-segmentation near the edited span only.

## 4.4 Virtualize or Window Long Read Surfaces

Priority: P1

Current issue:

`read`, `immersive`, and `document` modes render all visible blocks directly.

Why:

1. Fine for modest manuscripts.
2. Risky for very large corpora or pasted full texts.

Suggested action:

1. Introduce simple windowing for read/document lists once real corpus size demands it.
2. Preserve target line selection and scroll-to-block behavior carefully if virtualized.

## 4.5 Debounce or Stage Autosave and Persistence Writes

Priority: P1

Current issue:

The app autosaves snapshots and lexical history on state changes with timer-based effects.

Suggested action:

1. Keep autosave, but isolate it into a dedicated hook with a clear debounce policy.
2. Consider diff-aware persistence for large sessions.
3. Avoid serializing unchanged `displaySettings` or large session payloads too frequently.

## 4.6 Reduce Duplicate Formatting Work in Preview and Compare Panes

Priority: P1

Current issue:

Composer preview and compare panes often recompute similar text in parallel.

Suggested action:

1. Compute a single shared preview model:
   source
   primary formatted text
   compare formatted text
   Devanagari mapped result
   word ranges
   caret maps
2. Feed that model into both panes.

## 4.7 Lazy-Load Rare Utilities and Non-Core Panels

Priority: P2

Candidates:

1. Tamil Precision Recovery
2. large workspace panel tabs
3. partial settings/reference screens

Why:

1. Main typing flow should remain the cheapest path.
2. Secondary utilities do not need to be part of initial runtime weight.

## 4.8 Audit Clipboard and DOM Query Patterns

Priority: P2

Current issue:

There are several `document.querySelector` and `setTimeout` loops used to focus or restore selection.

Suggested action:

1. Replace with ref-driven targeting where possible.
2. Encapsulate the remaining imperative focus restore into one helper.

This is partly performance, partly maintainability.

## 5. Testing and Quality Opportunities

## 5.0 Revalidate Proof Before Expanding Coverage

Priority: P0

Why:

1. A small set of Playwright specs currently mixes valid assertions with stale selectors.
2. That weakens the repo's ability to use the test suite as documentation proof.
3. Fixing those specs is cheaper than carrying uncertain coverage claims forward.

Suggested action:

1. Repair [`session-management.spec.ts`](../../session-management.spec.ts) against current workspace selectors.
2. Repair [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts) against the current display tab structure.
3. Repair stale selectors inside [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) and [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts).

Expected payoff:

1. Stronger audit accuracy.
2. More trustworthy regression protection.
3. Cleaner distinction between current behavior and aspirational behavior.

## 5.1 Add Explicit Tests for Stale or Partial Screens

Priority: P1

Why:

1. If partial screens are retained, tests should lock in their bounded behavior.
2. This avoids UI drift that looks like a feature but is not.

## 5.2 Add Focused Unit Tests for Segmentation Policy

Priority: P1

Why:

1. Block segmentation currently affects editing correctness.
2. It deserves direct tests apart from end-to-end UI coverage.

## 5.3 Add Performance Smoke Tests for Large Session Loads

Priority: P2

Why:

1. Large local sessions and long corpora are central to the product’s use case.
2. Startup and document-mode rendering should be watched for regressions.

## 6. Suggested Execution Order

## Phase 1

1. Remove or archive dead files.
2. Fix naming drift and stale docs.
3. Make partial routes honest or hide them.

## Phase 2

1. Split `useFlowStore.ts`.
2. Split `StickyTopComposer.tsx`.
3. Split `TransliterationEngine.tsx`.

## Phase 3

1. Narrow Zustand subscriptions.
2. Memoize hot derived render paths.
3. Revisit segmentation and document rendering after profiling.

## 7. Highest-Value Next Steps

If only a few actions are taken, these have the best payoff:

1. Clean up dead code and misleading UI.
2. Break up `useFlowStore.ts`.
3. Break up `StickyTopComposer.tsx`.
4. Narrow store subscriptions in the three largest runtime components.
5. Update README to match the real architecture.
