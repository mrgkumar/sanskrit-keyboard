# Feature Test Coverage Audit

Date: 2026-04-15
Scope: feature coverage against the functional requirements listed in [`01-system-audit.md`](./01-system-audit.md), with emphasis on whether each feature has true unit-level coverage and whether the cited proofs still match the current runtime.

## 0. Proof Standard

This document is stricter than a plain test inventory.

Evidence hierarchy used here:

1. `Unit`
   Logic-level proof from specs that exercise transliteration, store helpers, or data logic without relying on browser markup.
2. `UI-Current`
   Browser-level proof from specs whose selectors and flows still match the current runtime markup.
3. `UI-Questionable`
   Browser-level proof exists, but at least part of the spec references selectors not found in the current runtime source.
4. `Mixed`
   Combination of `Unit` plus either `UI-Current` or `UI-Questionable`.
5. `Indirect`
   Behavior is plausibly exercised by broader tests, but not asserted directly as a feature contract.
6. `Gap`
   No clear direct test found.

Important correction:

1. Earlier audit language overstated some UI coverage.
2. [`session-management.spec.ts`](../../session-management.spec.ts), [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts), and parts of [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) reference selectors that do not exist in current runtime source.
3. Because of that, those files are weak proof for coverage until they are revalidated.

## 1. Answer

Do we have unit tests for all features from [`01-system-audit.md`](./01-system-audit.md)?

Answer:

1. No.

What is actually true:

1. Core transliteration behavior is well covered at unit level.
2. Several important UI workflows are covered by current browser tests.
3. Some workflows previously marked as covered are only weakly supported because the cited Playwright specs appear stale.
4. Store-heavy editor workflows still lack strong direct unit coverage.

## 2. Summary

## 2.1 Strongest Areas

1. Forward transliteration contract.
2. Reverse transliteration contract.
3. Alias canonicalization and Baraha compatibility rules.
4. Output-target migration and legacy snapshot migration.
5. Devanagari display normalization.
6. Tamil precision rendering and bounded reverse parsing.
7. Lexical normalization and runtime ranking behavior.

## 2.2 Current UI-Covered Areas

1. Read/document/immersive mode rendering.
2. Delete-block undo toast behavior.
3. Composer compare/read-as switching.
4. Resize persistence for composer panes.
5. Tamil Precision Recovery utility.
6. Reference insertion and prediction tray behavior in the main workflow suite.

## 2.3 Weak or Overstated Areas From the Earlier Pass

1. Session search/rename/delete flows were previously treated as solid UI proof, but the current spec references missing selectors.
2. Paste-normalization UI coverage was previously treated as current, but the current spec references missing selectors.
3. Lexical-learning reset coverage was previously treated as current, but two selector targets are missing from the current UI source.
4. Baraha UI coverage is mixed: some assertions match the runtime, but the input-scheme toggle selector in the spec does not.

## 2.4 Clear Gaps

1. No direct unit tests for segmentation policy.
2. No direct unit tests for `splitBlock`, `mergeBlocks`, `deleteBlock`, or `restoreDeletedBlock`.
3. No direct unit tests for session orchestration methods in the store.
4. No direct unit tests for autosave timing/debounce behavior in the engine shell.
5. No direct tests for onboarding redirect logic.
6. No direct tests for the mobile optimization notice.
7. No direct tests for reference usage ranking or category toggle state.

## 3. Feature Matrix

## 3.1 Input and Editing

1. Canonical and Baraha-compatible ITRANS input
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Note: unit proof is strong; Baraha UI proof is partially stale because the spec uses `input-scheme-baraha`, while the current UI uses plain buttons in [`TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx).

2. Multiline composer input
   Status: `UI-Current`
   Evidence:
   [`long-text-splits.spec.ts`](../../long-text-splits.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

3. `Enter` inserts newline in active chunk
   Status: `Indirect`
   Evidence:
   exercised by long-text typing flows, but no direct assertion was found for newline semantics alone.

4. `Shift+Enter` splits current block
   Status: `Indirect`
   Evidence:
   chunk-splitting workflows appear to be exercised in browser tests, but there is no direct unit proof for `splitBlock` semantics and no crisp UI assertion specifically for `Shift+Enter`.

5. Devanagari paste detransliterates to canonical ITRANS
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: unit proof is strong. UI proof is weaker because [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts) references missing selectors.

6. Alias input stays raw while typing and canonicalizes on commit
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)

7. Visarga/svara marker auto-swap
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
   Note: unit coverage is the reliable proof. The browser spec should be revalidated before it is treated as current proof.

8. Long blocks auto-segment
   Status: `Indirect`
   Evidence:
   chunk-based flows exist throughout UI tests, but there is no direct unit test for segmentation policy such as `createSegments()` or `isLongBlockSource()`.

## 3.2 Block and Chunk Workflow

1. Document is block-based
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   [`document-scroll.spec.ts`](../../document-scroll.spec.ts)

2. Long blocks edit chunk-by-chunk
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   [`cursor-stability.spec.ts`](../../cursor-stability.spec.ts)

3. Navigate between chunks and blocks
   Status: `UI-Current`
   Evidence:
   [`delayed-test.spec.ts`](../../delayed-test.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

4. Merge blocks
   Status: `Gap`
   Evidence:
   code exists in [`useFlowStore.ts`](../../src/store/useFlowStore.ts), but no direct test was found.

5. Delete block and restore through undo toast
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: this stays `UI-Current` because the cited delete/undo assertions use selectors that still exist, including `recently-deleted-block`.

6. Blank document represented by a single empty block
   Status: `Indirect`
   Evidence:
   implied by new-session and reset flows, but no direct assertion was found.

## 3.3 Rendering and Output Targets

1. Primary output script drives main read surfaces
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

2. Comparison output only in top composer
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

3. Roman output supports canonical and Baraha styles
   Status: `Unit`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)

4. Tamil output exposes only `precision`
   Status: `Unit`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)

5. Devanagari display normalization is font-aware
   Status: `Unit`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)

6. Tamil precision display normalization
   Status: `Unit`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)

## 3.4 Reading and Navigation

1. `document` mode block canvas
   Status: `UI-Current`
   Evidence:
   [`document-scroll.spec.ts`](../../document-scroll.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

2. `read` mode line-oriented reading
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

3. `immersive` mode full-height reading
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

4. Clicking read text jumps back into edit/review context
   Status: `UI-Current`
   Evidence:
   [`cursor-stability.spec.ts`](../../cursor-stability.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

5. Immersive single-click select, double-click return to read
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

6. `review` mode exposes source/rendered segment inspection
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

## 3.5 Reference and Assistance

1. Searchable reference mappings insert into active chunk
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

2. Reference cards track usage for quick access
   Status: `Gap`
   Evidence:
   store logic exists, but no direct test was found for `referenceUsage` ranking behavior.

3. Join controls `^z` and `^Z` are surfaced
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

4. Character-level suggestions and phonetic alternatives in HUD
   Status: `UI-Current`
   Evidence:
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)

5. Word predictions support `inline`, `split`, `footer`, `listbox`
   Status: `Mixed`
   Evidence:
   [`runtime-lexicon.spec.ts`](../../runtime-lexicon.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: ranking and normalization have strong unit proof. Some lexical UI assertions are current, but reset-related selectors in [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) are stale.

## 3.6 Session Management

1. Create new session
   Status: `UI-Current`
   Evidence:
   current workspace flows in [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) and other UI suites use the `Workspace` drawer plus `New` action successfully.

2. Resume latest session
   Status: `Indirect`
   Evidence:
   runtime source clearly supports session landing and reload behavior, but no direct current test was found specifically for resume-latest semantics.

3. Rename/delete/search sessions
   Status: `UI-Questionable`
   Evidence:
   [`session-management.spec.ts`](../../session-management.spec.ts)
   Note: the spec references `workspace-sidebar` and `session-rename-input`, which are not present in current runtime markup. Treat this as stale proof until revalidated.

4. Sessions autosave on timer
   Status: `UI-Questionable`
   Evidence:
   [`session-management.spec.ts`](../../session-management.spec.ts)
   Note: persistence intent is real in runtime source, but the cited browser proof is stale and there is still no direct timing/debounce test.

5. Legacy v1 session migration to v2
   Status: `Unit`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)

## 3.7 Utilities

1. Whole-document copy in explicit scripts
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Note: current runtime definitely exposes whole-document copy actions, but the baraha UI spec mixes current assertions with one stale selector for the input-scheme toggle.

2. Tamil Precision Recovery bounded to precision input
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`tamil-precision-recovery-ui.spec.ts`](../../tamil-precision-recovery-ui.spec.ts)
   [`tamil-reverse-ui-boundary.spec.ts`](../../tamil-reverse-ui-boundary.spec.ts)

3. Reset session-local and persisted lexical learning
   Status: `UI-Questionable`
   Evidence:
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: the current runtime still exposes reset and purge buttons in [`TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx), but the spec uses missing selectors `clear-session-learning` and `swara-prediction-toggle`.

## 4. Missing Direct Unit-Test Coverage

These are the highest-value audited features that still do not have direct unit tests:

1. Segmentation policy
   `createSegments`, long-block heuristics, offset stability.
2. Store-level block editing operations
   `addBlocks`, `splitBlock`, `mergeBlocks`, `deleteBlock`, `restoreDeletedBlock`.
3. Store-level mode transitions
   `document`, `read`, `review`, `immersive`, `focus`.
4. Reference state logic
   `incrementReferenceUsage`, `toggleReferenceCategory`.
5. Session state orchestration
   `markSessionSaved`, `deleteSession`, `renameSession`, `resetSession`, `loadSessionSnapshot`.
6. Autosave timer behavior in the engine shell.
7. First-visit onboarding redirect logic.
8. Mobile optimization notice behavior.

## 5. Specs That Need Revalidation Before They Are Used As Proof

1. [`session-management.spec.ts`](../../session-management.spec.ts)
   Uses `workspace-sidebar` and `session-rename-input`, which are not present in current source.
2. [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
   Uses `workspace-sidebar` and `display-settings-toggle`, which are not present in current source.
3. [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Contains current flows, but also uses missing selectors `swara-prediction-toggle` and `clear-session-learning`.
4. [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Mostly current, but uses missing selector `input-scheme-baraha`.

## 6. Conclusion

The corrected conclusion is narrower and more defensible:

1. The repo has strong unit coverage for transliteration correctness and output formatting.
2. The repo has meaningful browser coverage for current editor and reading workflows.
3. The repo does not have unit tests for all features from [`01-system-audit.md`](./01-system-audit.md).
4. The repo also has a small cluster of stale browser specs, so test-file presence alone is not sufficient proof of active feature coverage.

## 7. Best Next Additions

1. Add direct store tests for block operations.
2. Add direct segmentation-policy tests.
3. Add current UI tests for session rename/delete/search with real selectors.
4. Add current UI tests for lexical reset/purge controls.
5. Add small route tests for onboarding redirect and mobile warning behavior.
