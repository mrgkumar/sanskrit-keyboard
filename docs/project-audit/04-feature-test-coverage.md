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
2. [`session-management.spec.ts`](../../session-management.spec.ts), [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts), [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts), and [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts) were repaired in this pass to match current runtime selectors.
3. Those files now count as current browser proof again, while direct timer-level or store-level gaps remain where noted below.

## 1. Answer

Do we have unit tests for all features from [`01-system-audit.md`](./01-system-audit.md)?

Answer:

1. No.

What is actually true:

1. Core transliteration behavior is well covered at unit level.
2. Several important UI workflows are covered by current browser tests.
3. The previously stale browser specs have been repaired and now match the current runtime markup.
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
8. Block-level store contracts for splitting, merging, deletion, restoration, and long-block segmentation.
9. Session orchestration and durable snapshot persistence.

## 2.2 Current UI-Covered Areas

1. Read/document/immersive mode rendering.
2. Delete-block undo toast behavior.
3. Composer compare/read-as switching.
4. Resize persistence for composer panes.
5. Tamil Precision Recovery utility.
6. Reference insertion and prediction tray behavior in the main workflow suite.
7. Session search, rename, delete, and persistence across reloads.
8. Paste normalization for ITRANS and Devanagari input.
9. Lexical reset and global purge controls.

## 2.3 Weak or Overstated Areas From the Earlier Pass

1. Session search/rename/delete flows were previously treated as stale proof, but the spec is now repaired and current.
2. Paste-normalization UI coverage is current again after selector repair.
3. Lexical-learning reset coverage is current again after selector repair.
4. Baraha UI coverage is current again after selector repair.

## 2.4 Clear Gaps

1. No direct unit tests for autosave timing/debounce behavior in the engine shell.
2. No direct tests for onboarding redirect logic.
3. No direct tests for the mobile optimization notice.
4. No direct tests for reference usage ranking or category toggle state.

## 3. Feature Matrix

## 3.1 Input and Editing

1. Canonical and Baraha-compatible ITRANS input
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Note: unit proof is strong; Baraha UI proof now matches the current display-tab controls in [`TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx).

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
   Note: unit proof is strong. UI proof is current again after selector repair.

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
   Note: unit coverage is the reliable proof. The browser spec now matches the current intelligence-tab controls.

8. Long blocks auto-segment
   Status: `Unit`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)

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
   Status: `Unit`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)

5. Delete block and restore through undo toast
   Status: `Mixed`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)
   [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: this now has both direct store coverage and browser proof.

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
   Note: ranking and normalization have strong unit proof. Lexical UI coverage is now current, including reset and purge controls.

## 3.6 Session Management

1. Create new session
   Status: `Mixed`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)
   current workspace flows in [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts) and other UI suites use the `Workspace` drawer plus `New` action successfully.

2. Resume latest session
   Status: `Indirect`
   Evidence:
   runtime source clearly supports session landing and reload behavior, but no direct current test was found specifically for resume-latest semantics.

3. Rename/delete/search sessions
   Status: `Mixed`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)
   [`session-management.spec.ts`](../../session-management.spec.ts)
   Note: the repaired spec now uses the current workspace panel and session controls.

4. Sessions autosave on timer
   Status: `Indirect`
   Evidence:
   [`session-management.spec.ts`](../../session-management.spec.ts)
   Note: persistence across reload is covered, but there is still no direct timing/debounce test.

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
   Note: current runtime exposes whole-document copy actions and the repaired Baraha spec now aligns with the display-tab toggle.

2. Tamil Precision Recovery bounded to precision input
   Status: `Mixed`
   Evidence:
   [`transliteration.spec.ts`](../../transliteration.spec.ts)
   [`tamil-precision-recovery-ui.spec.ts`](../../tamil-precision-recovery-ui.spec.ts)
   [`tamil-reverse-ui-boundary.spec.ts`](../../tamil-reverse-ui-boundary.spec.ts)

3. Reset session-local and persisted lexical learning
   Status: `UI-Current`
   Evidence:
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Note: the current runtime exposes reset and purge buttons in [`TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx), and the repaired spec now uses those labels.

## 3.8 Store Contracts

1. Block editing actions `addBlocks`, `splitBlock`, `mergeBlocks`, `deleteBlock`, `restoreDeletedBlock`
   Status: `Unit`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)

2. Session orchestration and durable persistence
   Status: `Unit`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)

3. Long-block segmentation policy
   Status: `Unit`
   Evidence:
   [`store-contract.spec.ts`](../../store-contract.spec.ts)

## 4. Missing Direct Unit-Test Coverage

These are the highest-value audited features that still do not have direct unit tests:

1. Store-level mode transitions
   `document`, `read`, `review`, `immersive`, `focus`.
2. Reference state logic
   `incrementReferenceUsage`, `toggleReferenceCategory`.
3. Autosave timer behavior in the engine shell.
4. First-visit onboarding redirect logic.
5. Mobile optimization notice behavior.

## 5. Revalidated Specs

1. [`session-management.spec.ts`](../../session-management.spec.ts)
   Current session search, rename, delete, and reload persistence coverage.
2. [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
   Current ITRANS and Devanagari paste normalization coverage.
3. [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Current lexical prediction, reset, and purge coverage.
4. [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Current Baraha-compatible input and whole-document copy coverage.

## 6. Conclusion

The corrected conclusion is narrower and more defensible:

1. The repo has strong unit coverage for transliteration correctness and output formatting.
2. The repo has meaningful browser coverage for current editor and reading workflows.
3. The repo does not have unit tests for all features from [`01-system-audit.md`](./01-system-audit.md).
4. The repo still has coverage gaps in store-level behavior, autosave timing, and some route-level decisions.

## 7. Best Next Additions

1. Add direct store tests for block operations.
2. Add direct segmentation-policy tests.
3. Add current UI tests for session rename/delete/search with real selectors.
4. Add current UI tests for lexical reset/purge controls.
5. Add small route tests for onboarding redirect and mobile warning behavior.
