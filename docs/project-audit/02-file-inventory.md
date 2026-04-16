# Sanskrit Keyboard File Inventory

Date: 2026-04-15
Scope: `app/` repository inventory, organized by role.

## 0. Reading This Inventory

Status labels used here:

1. `Active`
   Referenced by the current runtime path.
2. `Support`
   Used by build/test/data workflows, not directly by runtime UI.
3. `Partial`
   Present in runtime or route structure, but not fully wired.
4. `Unused`
   No active runtime references found during the audit pass.

## 1. Root-Level Product and Config Files

1. [`AGENTS.md`](../../AGENTS.md)
   Repo-local instructions for coding agents.
2. [`CLAUDE.md`](../../CLAUDE.md)
   Secondary agent guidance/context file.
3. [`README.md`](../../README.md)
   Public-facing project overview; partially stale relative to runtime.
4. [`LICENSE`](../../LICENSE)
   Repository license.
5. [`package.json`](../../package.json)
   Scripts, dependencies, deploy/build commands.
6. [`package-lock.json`](../../package-lock.json)
   npm lockfile.
7. [`tsconfig.json`](../../tsconfig.json)
   TypeScript config.
8. [`next.config.mjs`](../../next.config.mjs)
   Next.js config.
9. [`playwright.config.ts`](../../playwright.config.ts)
   Test runner config and dev-server bootstrap.
10. [`eslint.config.mjs`](../../eslint.config.mjs)
    ESLint config.
11. [`postcss.config.mjs`](../../postcss.config.mjs)
    Tailwind/PostCSS config.
12. [`next-env.d.ts`](../../next-env.d.ts)
    Next.js TypeScript ambient declarations.
13. [`project-context.md`](../../project-context.md)
    Agent-oriented implementation summary.
14. [`tsconfig.tsbuildinfo`](../../tsconfig.tsbuildinfo)
    Generated TypeScript build artifact.
15. [`.gitignore`](../../.gitignore)
    Git ignore rules.

## 2. App Routes

1. [`src/app/layout.tsx`](../../src/app/layout.tsx)
   `Active`. Global layout, local font registration, mobile warning overlay.
2. [`src/app/page.tsx`](../../src/app/page.tsx)
   Main route, onboarding redirect, session landing gate, dynamic engine import.
3. [`src/app/welcome/page.tsx`](../../src/app/welcome/page.tsx)
   Walkthrough/onboarding page.
4. [`src/app/help/page.tsx`](../../src/app/help/page.tsx)
   Mapping/help documentation page built from `VEDIC_MAPPINGS`.
5. [`src/app/reference/page.tsx`](../../src/app/reference/page.tsx)
   Reference browser route; separate study surface, not the main transcription workspace.
6. [`src/app/settings/mappings/page.tsx`](../../src/app/settings/mappings/page.tsx)
   `Partial`. Mapping/settings route with partially wired UI.
7. [`src/app/globals.css`](../../src/app/globals.css)
   Global styles, script/font classes, workspace styling.
8. [`src/app/favicon.ico`](../../src/app/favicon.ico)
   Favicon asset.

## 3. Runtime Components

### 3.1 Main Workspace

1. [`src/components/engine/TransliterationEngine.tsx`](../../src/components/engine/TransliterationEngine.tsx)
   Main workspace shell, left drawer, persistence wiring, view controls, utility panels.
2. [`src/components/StickyTopComposer.tsx`](../../src/components/StickyTopComposer.tsx)
   Primary editable chunk surface, previews, compare mode, copy actions, prediction popup.
3. [`src/components/MainDocumentArea.tsx`](../../src/components/MainDocumentArea.tsx)
   Read/review/document/immersive rendering surface.
4. [`src/components/ReferenceSidePanel.tsx`](../../src/components/ReferenceSidePanel.tsx)
   Right-side slide-in wrapper for the reference library.
5. [`src/components/ScriptText.tsx`](../../src/components/ScriptText.tsx)
   Script-aware rendering wrapper with font-preset support.
6. [`src/components/VerticalResizeHandle.tsx`](../../src/components/VerticalResizeHandle.tsx)
   Generic pointer-based resize handle used in composer and document panes.

### 3.2 Engine Support

1. [`src/components/engine/SessionLanding.tsx`](../../src/components/engine/SessionLanding.tsx)
   Pre-workspace session chooser.
2. [`src/components/engine/WordPredictionTray.tsx`](../../src/components/engine/WordPredictionTray.tsx)
   Word-level autocomplete UI in four layouts.
3. [`src/components/engine/ShortcutHUD.tsx`](../../src/components/engine/ShortcutHUD.tsx)
   Character assist, alternates, phonetic completions, footer predictions.
4. [`src/components/engine/TamilPrecisionRecovery.tsx`](../../src/components/engine/TamilPrecisionRecovery.tsx)
   Bounded Tamil precision reverse utility.

### 3.3 Reference and Secondary UI

1. [`src/components/reference/ReferenceLibrary.tsx`](../../src/components/reference/ReferenceLibrary.tsx)
   Searchable mapping browser and insertion tool.
2. [`src/components/reference/VedicReferencePane.tsx`](../../src/components/reference/VedicReferencePane.tsx)
   Study pane used on the `/reference` route.
3. [`src/components/settings/MappingManager.tsx`](../../src/components/settings/MappingManager.tsx)
   `Partial`. Mapping browser with unwired edit affordances.
4. [`src/components/MobileOptimizationNotice.tsx`](../../src/components/MobileOptimizationNotice.tsx)
   Desktop-first warning overlay.
5. [`src/components/ui/SkeletonLoader.tsx`](../../src/components/ui/SkeletonLoader.tsx)
   Loading placeholder for the dynamic engine import.
6. [`src/components/audit/UnicodeInspector.tsx`](../../src/components/audit/UnicodeInspector.tsx)
   `Unused`. Inspection component with no active runtime references found.

## 4. State and Hooks

1. [`src/store/types.ts`](../../src/store/types.ts)
   Shared domain types for blocks, segments, sessions, display settings, and modes.
2. [`src/store/useFlowStore.ts`](../../src/store/useFlowStore.ts)
   Zustand store and most business logic.
3. [`src/hooks/useSyncScroll.ts`](../../src/hooks/useSyncScroll.ts)
   `Unused`. Scroll-sync hook with no active runtime imports found.

## 5. Transliteration and Data Libraries

1. [`src/lib/vedic/mapping.ts`](../../src/lib/vedic/mapping.ts)
   Source-of-truth transliteration mappings and output-target model.
2. [`src/lib/vedic/utils.ts`](../../src/lib/vedic/utils.ts)
   Forward/reverse transliteration and script formatting logic.
3. [`src/lib/vedic/runtimeLexicon.ts`](../../src/lib/vedic/runtimeLexicon.ts)
   Runtime autocomplete loading, scoring, and swara variant ranking.
4. [`src/lib/vedic/lexicalNormalization.ts`](../../src/lib/vedic/lexicalNormalization.ts)
   Lexical normalization helpers for lookup and corpus preparation.
5. [`src/lib/server/autocompleteDataRoot.ts`](../../src/lib/server/autocompleteDataRoot.ts)
   `Support`. Shared output-path helper for dataset generation scripts.
6. [`src/lib/version.ts`](../../src/lib/version.ts)
   `Support`. Build version metadata generated before build and displayed in the workspace.
7. [`src/lib/vedic/db.ts`](../../src/lib/vedic/db.ts)
   `Unused`. Dexie wrapper with no active runtime imports found.
8. [`src/lib/vedic/export.ts`](../../src/lib/vedic/export.ts)
   `Unused`. Export-format helper with no active runtime imports found.
9. [`src/lib/utils.ts`](../../src/lib/utils.ts)
   `Unused`. `cn()` helper with no active runtime imports found.

## 6. Build and Data Pipeline Scripts

1. [`scripts/copyAutocompleteAssets.mjs`](../../scripts/copyAutocompleteAssets.mjs)
   Copies generated autocomplete assets into deployable/static locations.
2. [`scripts/generateVersion.mjs`](../../scripts/generateVersion.mjs)
   Writes build metadata into `src/lib/version.ts`.
3. [`scripts/git-tag-version.mjs`](../../scripts/git-tag-version.mjs)
   Git tag helper for deploy/version workflow.
4. [`scripts/serve-static-export.mjs`](../../scripts/serve-static-export.mjs)
   Serves built static export locally.
5. [`scripts/buildCanonicalLexicon.ts`](../../scripts/buildCanonicalLexicon.ts)
   Builds canonical lexicon data.
6. [`scripts/buildCanonicalLexiconShared.ts`](../../scripts/buildCanonicalLexiconShared.ts)
   Shared helpers for canonical lexicon generation.
7. [`scripts/buildCanonicalLexiconWorker.ts`](../../scripts/buildCanonicalLexiconWorker.ts)
   Worker-oriented support for canonical lexicon generation.
8. [`scripts/buildRuntimeLexicon.ts`](../../scripts/buildRuntimeLexicon.ts)
   Builds sharded runtime autocomplete data.
9. [`scripts/buildSwaraLexicon.ts`](../../scripts/buildSwaraLexicon.ts)
   Builds swara variant lexicon.
10. [`scripts/buildCompletionTrainingData.ts`](../../scripts/buildCompletionTrainingData.ts)
    Produces training/eval data for prediction experiments.
11. [`scripts/rebuildPredictionCorpus.ts`](../../scripts/rebuildPredictionCorpus.ts)
    Orchestrates prediction corpus rebuild.
12. [`scripts/preparePredictionDataset.ts`](../../scripts/preparePredictionDataset.ts)
    Prepares datasets for prediction experiments.
13. [`scripts/evaluatePredictionCorpus.ts`](../../scripts/evaluatePredictionCorpus.ts)
    Evaluates prediction corpus outputs.
14. [`scripts/evaluatePredictionRetrieval.ts`](../../scripts/evaluatePredictionRetrieval.ts)
    Measures prefix retrieval quality.
15. [`scripts/analyzePredictionRetrievalGaps.ts`](../../scripts/analyzePredictionRetrievalGaps.ts)
    Gap analysis for retrieval misses.
16. [`scripts/analyzePredictionRetrievalMissTaxonomy.ts`](../../scripts/analyzePredictionRetrievalMissTaxonomy.ts)
    Categorizes retrieval misses.
17. [`scripts/runPredictionExperimentGame.ts`](../../scripts/runPredictionExperimentGame.ts)
    Runs prediction experiment leaderboard generation.
18. [`scripts/runProbabilisticPredictionGame.py`](../../scripts/runProbabilisticPredictionGame.py)
    Python-side probabilistic prediction experiments.
19. [`scripts/runSanskritPredictionGame.py`](../../scripts/runSanskritPredictionGame.py)
    Sanskrit-focused prediction experiments.
20. [`scripts/runSupervisedPredictionGame.py`](../../scripts/runSupervisedPredictionGame.py)
    Supervised prediction experiments.
21. [`scripts/processHarvestedCorpus.ts`](../../scripts/processHarvestedCorpus.ts)
    Processes harvested word corpora.

## 7. Top-Level Utility and Legacy Data Files

1. [`combine_all.mjs`](../../combine_all.mjs)
   Data aggregation helper for harvested links/content.
2. [`filter_links.mjs`](../../filter_links.mjs)
   Link filtering helper.
3. [`debug-corpus.js`](../../debug-corpus.js)
   Ad hoc corpus debugging script; currently the only lint failure.
4. [`all_links.json`](../../all_links.json)
   Harvested/combined link data.
5. [`all_links_debug.json`](../../all_links_debug.json)
   Debug variant of harvested link data.
6. [`combined_links.json`](../../combined_links.json)
   Combined link set.
7. [`veda_links.json`](../../veda_links.json)
   Veda link list.
8. [`upa_links.json`](../../upa_links.json)
   Upanishad link list.
9. [`shiva_stotram_links_filtered.json`](../../shiva_stotram_links_filtered.json)
   Filtered Shiva stotra links.
10. [`shiva_stotrams.json`](../../shiva_stotrams.json)
    Shiva stotra corpus/source data.
11. [`harvested_combined_words.jsonl`](../../harvested_combined_words.jsonl)
    Harvested combined lexical corpus.
12. [`harvested_itrans_corpus.jsonl`](../../harvested_itrans_corpus.jsonl)
    Harvested ITRANS corpus.
13. [`harvested_shiva_words.jsonl`](../../harvested_shiva_words.jsonl)
    Shiva-specific harvested lexical corpus.
14. [`vignanam_screenshot.png`](../../vignanam_screenshot.png)
    Visual reference/debug asset.
15. [`chandas.ttf`](../../chandas.ttf)
    Root font file; actual runtime uses font copies under `public/fonts/`.

## 8. Test Suite

Proof-quality note:

1. Presence in this section means the file exists and is relevant to the repo.
2. It does not guarantee the spec is current against the present UI.
3. Some UI specs reference selectors that do not appear in current runtime code.

### 8.1 Core Transliteration and State Logic

1. [`transliteration.spec.ts`](../../transliteration.spec.ts)
   Main engine, reverse transliteration, migration, output-target, and Gate-style contract tests.
2. [`runtime-lexicon.spec.ts`](../../runtime-lexicon.spec.ts)
   Runtime lexicon logic tests.
3. [`prediction-eval.spec.ts`](../../prediction-eval.spec.ts)
   Prediction evaluation checks.
4. [`prediction-experiments.spec.ts`](../../prediction-experiments.spec.ts)
   Prediction experiment validation.
5. [`completion-training-data.spec.ts`](../../completion-training-data.spec.ts)
   Completion training dataset checks.
6. [`corpus-pipeline.spec.ts`](../../corpus-pipeline.spec.ts)
   Corpus/data pipeline checks.
7. [`harvested-corpus.spec.ts`](../../harvested-corpus.spec.ts)
   Forward transliteration checks against harvested corpus.
8. [`vignanam-hard-corpus.spec.ts`](../../vignanam-hard-corpus.spec.ts)
   Frozen golden corpus references.
9. [`bulk-roundtrip.spec.ts`](../../bulk-roundtrip.spec.ts)
   Large roundtrip validation for corpora.
10. [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts)
    Paste normalization behavior checks.

### 8.2 UI and Interaction

1. [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts)
   Prediction flows, delete flows, and lexical learning UI.
2. [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts)
   Alias input and Baraha-compatible behavior.
3. [`cursor-stability.spec.ts`](../../cursor-stability.spec.ts)
   Cursor stability regression test.
4. [`document-scroll.spec.ts`](../../document-scroll.spec.ts)
   Read/document scroll behavior.
5. [`long-text-splits.spec.ts`](../../long-text-splits.spec.ts)
   Long snippet split stability.
6. [`responsive-long-snippet.spec.ts`](../../responsive-long-snippet.spec.ts)
   Responsive inspection for long snippets.
7. [`session-management.spec.ts`](../../session-management.spec.ts)
   Session behaviors, but likely stale against current selectors.
8. [`startup-performance.spec.ts`](../../startup-performance.spec.ts)
   Startup timing inspection.
9. [`ui-regressions.spec.ts`](../../ui-regressions.spec.ts)
   Targeted interaction regressions.
10. [`tamil-precision-recovery-ui.spec.ts`](../../tamil-precision-recovery-ui.spec.ts)
    Utility-panel recovery UI tests.
11. [`tamil-reverse-ui-boundary.spec.ts`](../../tamil-reverse-ui-boundary.spec.ts)
    Guards against overclaiming generic Tamil reverse support.
12. [`delayed-test.spec.ts`](../../delayed-test.spec.ts)
    Broader workflow-style UI test.

### 8.3 Data Harvesting Helpers Disguised as Specs

1. [`scrape_links.spec.ts`](../../scrape_links.spec.ts)
   Link harvesting script run through Playwright.
2. [`harvest_shiva_words.spec.ts`](../../harvest_shiva_words.spec.ts)
   Word harvesting.
3. [`harvest_combined_words.spec.ts`](../../harvest_combined_words.spec.ts)
   Combined corpus harvesting.

These are operational scripts packaged as tests rather than user-facing regression tests.

## 9. Test Support Files

1. [`test-support/transliterationCorpus.ts`](../../test-support/transliterationCorpus.ts)
   Transliteration corpus fixtures/helpers.
2. [`test-support/corpusRegistry.ts`](../../test-support/corpusRegistry.ts)
   Corpus registry helpers.
3. [`test-support/corpusText.ts`](../../test-support/corpusText.ts)
   Corpus text helpers.
4. [`test-support/sanTrainCorpus.ts`](../../test-support/sanTrainCorpus.ts)
   Sanskrit training corpus support.
5. [`test-support/predictionEvaluation.ts`](../../test-support/predictionEvaluation.ts)
   Prediction evaluation helpers.
6. [`test-support/predictionExperimentProfiles.ts`](../../test-support/predictionExperimentProfiles.ts)
   Experiment profile definitions.
7. [`test-support/completionTrainingData.ts`](../../test-support/completionTrainingData.ts)
   Completion training fixtures.
8. [`test-support/vignanamHardCorpus.ts`](../../test-support/vignanamHardCorpus.ts)
   Vignanam hard corpus test data.
9. [`test-support/tamilPrecisionNotation.ts`](../../test-support/tamilPrecisionNotation.ts)
   Tamil precision notation helpers.
10. [`test-support/tamilPrecisionGoldens.ts`](../../test-support/tamilPrecisionGoldens.ts)
    Tamil precision golden cases.
11. [`test-support/tamilReverseFixtures.ts`](../../test-support/tamilReverseFixtures.ts)
    Tamil reverse fixtures.
12. [`test-support/tamilReverseGoldens.ts`](../../test-support/tamilReverseGoldens.ts)
    Tamil reverse goldens.
13. [`test-support/tamilReverseBarahaGoldens.ts`](../../test-support/tamilReverseBarahaGoldens.ts)
    Tamil reverse Baraha goldens.
14. [`test-support/barahaTamilFixtures.ts`](../../test-support/barahaTamilFixtures.ts)
    Baraha Tamil test fixtures.
15. [`test-support/fixtures/transliteration-corpus-review.csv`](../../test-support/fixtures/transliteration-corpus-review.csv)
    Review corpus.
16. [`test-support/fixtures/transliteration-corpus-hard-review.csv`](../../test-support/fixtures/transliteration-corpus-hard-review.csv)
    Hard review corpus.
17. [`test-support/fixtures/transliteration-corpus-hard-review-1000.csv`](../../test-support/fixtures/transliteration-corpus-hard-review-1000.csv)
    Sampled hard review corpus.

## 10. Public Assets and Static Media

1. [`public/fonts/`](../../public/fonts)
   Bundled font assets for Devanagari and Tamil presets used by the runtime.
2. [`public/*.svg`](../../public)
   Default static icons from the Next starter plus simple static assets.
3. [`docs/images/screenshot.png`](../../docs/images/screenshot.png)
   README screenshot asset.
4. [`tex-render-tests/`](../../tex-render-tests)
   LaTeX-based font/render experiments, not active runtime code.

## 11. Inventory Notes

1. The real application surface is concentrated in fewer files than the repo suggests: `useFlowStore.ts`, `mapping.ts`, `utils.ts`, `TransliterationEngine.tsx`, `StickyTopComposer.tsx`, and `MainDocumentArea.tsx`.
2. Several secondary files are dead or partially implemented. See [`01-system-audit.md`](./01-system-audit.md) for the stale/dead-code assessment.

## 12. Inventory Reliability Notes

1. This inventory distinguishes file existence from verified runtime use.
2. `Unused` means no active runtime reference was found during this audit pass.
3. `Partial` means the file is reachable from routes or UI, but the behavior is obviously incomplete or misleading.
4. Some spec files remain relevant but are only partially current. For example:
   [`session-management.spec.ts`](../../session-management.spec.ts),
   [`paste-normalization.spec.ts`](../../paste-normalization.spec.ts),
   [`lexical-ui.spec.ts`](../../lexical-ui.spec.ts),
   [`baraha-compatibility-ui.spec.ts`](../../baraha-compatibility-ui.spec.ts).
