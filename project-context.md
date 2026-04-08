# Project Context: Sanskrit Keyboard

This is the quick reference for the current implementation in the active Next.js app under `app/`.

## 1. What The App Is

Sanskrit Keyboard is a transliteration workspace for scholarly Sanskrit and Vedic text entry. The main experience is:

- type in ITRANS
- see live output in Roman, Devanagari, or Tamil
- edit chunk-by-chunk for longer passages
- keep a reference drawer available for mappings and shortcuts
- copy source or rendered output in several formats

The app is not a generic editor. It is a transliteration-focused tool with a strong read/edit split and session persistence.

## 2. Tech Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Zustand for app state
- Tailwind CSS 4
- Playwright for browser regression checks
- Dexie is present in dependencies, used for some persistence tasks

## 3. Entry Points And Routes

### Primary route

`app/src/app/page.tsx` renders `TransliterationEngine`, which composes the main workspace.

### Other routes

These routes exist for auxiliary or specialized workflows:

- `app/src/app/reference/page.tsx`
- `app/src/app/welcome/page.tsx`
- `app/src/app/dashboard/page.tsx`
- `app/src/app/settings/mappings/page.tsx`
- `app/src/app/groundtruth-label/page.tsx`
- `app/src/app/mock-output-target/page.tsx`

## 4. Current Workspace Layout

The live app has two major regions:

### Top composer

`StickyTopComposer` is the sticky editing surface. It contains:

- the ITRANS input (**supports multiline and paragraphs**)
- `Enter` for newline, `Shift+Enter` to split blocks (includes educational hints)
- live preview panes for the selected output script (side-by-side or stacked)
- compare mode in the top half only
- copy buttons for the active outputs
- reference and display controls
- word prediction UI (footer, inline, split, or listbox)

### Lower document area

`MainDocumentArea` is the read/review/immersive document surface. It behaves as a single-pane read view:

- compare mode is not shown in the lower area
- read and immersive modes use the primary rendered script only (Roman, Devanagari, or Tamil)
- immersive mode fits the viewport height
- single click in immersive mode selects a line
- double click in immersive mode returns to read mode and scrolls to the corresponding line

## 5. State Model

`app/src/store/useFlowStore.ts` is the central store.

It manages:

- `blocks`: canonical document units (`short` or `long`)
- `segments`: subdivisions for long blocks
- `ChunkGroup`: the active editing chunk in the composer
- `EditorState`: active block, focus span, view mode, and ghost assist state
- `DisplaySettings`: scripts, comparison mode, typography, presets, and prediction layout
- session persistence
- lexical suggestion learning and usage counts
- copied/deleted buffer state for the reference panel and quick correction flow

Important view modes:

- `focus`: Tight editing focus
- `read`: Standard document reading
- `review`: Reviewing changes
- `immersive`: Full-height reading experience
- `document`: Full document view

## 6. Typography And Display Controls

Typography is split between composer and document settings.

### Composer typography

The composer has independent controls for:

- ITRANS font size and line height
- Devanagari font size and line height
- Tamil font size and line height
- ITRANS panel height
- primary preview height
- compare preview height
- rendered font size and line height

### Document typography

The document/read area has independent controls for:

- ITRANS font size and line height
- Devanagari font size and line height
- Tamil font size and line height
- primary pane height
- compare pane height
- rendered font size and line height

### Defaults

- Sanskrit font preset defaults to `siddhanta`
- Tamil font preset defaults to `noto-serif`
- Tamil output style defaults to `precision`

## 7. Transliteration Engine

### Source of truth

`app/src/lib/vedic/mapping.ts` is the canonical mapping table and output-target definition layer.

- **Automated ZWNJ:** Inserted for Vedic visarga + accent combinations (e.g., `nai":`) to ensure font compatibility.
- **Font Optimization:** Uses specific PUA characters for `Chandas` font accuracy.

It defines:

- input schemes: `canonical-vedic`, `baraha-compatible`
- output scripts: `roman`, `devanagari`, `tamil`
- comparison output modes
- Roman output styles: `canonical`, `baraha`
- Tamil output styles: `precision`
- mapping metadata and labels

### Core helpers

`app/src/lib/vedic/utils.ts` contains the runtime transliteration helpers, including:

- forward transliteration (automatically calls `normalizeMarkerSequences`)
- reverse transliteration
- Tamil precision display normalization
- output formatting helpers
- source copy formatting helpers

## 8. Output Target Behavior

The app supports separate output target configuration:

- `Read As` for the primary output script
- `Compare` for the secondary top-composer preview

Supported primary scripts:

- Roman
- Devanagari
- Tamil

Compare mode only applies in the top composer.

## 9. Predictions And Reference UI

### Word predictions

Word predictions are driven by the `runtimeLexicon` and appear in the composer. They support multiple layouts (`footer`, `inline`, `split`, `listbox`) and render using the active output script.

### Reference panel

`ReferenceSidePanel` and `ReferenceLibrary` provide:

- searchable mapping cards
- insertion into the current composer chunk
- ZWNJ / ZWJ reference shortcuts

### Audit and Inspection

Specialized components for text integrity:
- `UnicodeInspector`: Deep inspection of character codes

## 10. Session And Persistence

The app persists workspace state in localStorage.

It stores:

- session snapshots
- session index
- lexical learning history

On reload, the latest session can be restored automatically.

The app provides session management features:
- **Search:** Filter saved sessions by name.
- **Delete:** Remove individual sessions from storage.
- **Rename:** Update the name of existing sessions.
- **Automatic Saving:** Current workspace state is periodically saved to the active session.

## 11. Main Components

The most important files for agent work are:

- `app/src/components/engine/TransliterationEngine.tsx`
- `app/src/components/StickyTopComposer.tsx`
- `app/src/components/MobileOptimizationNotice.tsx` (handles desktop-only warnings)
- `app/src/components/MainDocumentArea.tsx`
- `app/src/components/ReferenceSidePanel.tsx`
- `app/src/components/reference/ReferenceLibrary.tsx`
- `app/src/components/engine/WordPredictionTray.tsx`
- `app/src/components/engine/ShortcutHUD.tsx`
- `app/src/components/ScriptText.tsx`
- `app/src/components/audit/UnicodeInspector.tsx`
- `app/src/lib/vedic/mapping.ts`
- `app/src/lib/vedic/utils.ts`
- `app/src/store/useFlowStore.ts`
- `app/src/store/types.ts`

## 12. Testing

The main transliteration check is:

- `npm run test:transliteration`

There are also Playwright specs at the app root for UI behavior, including editor and transliteration interactions.

Useful commands from `app/`:

- `npm run build`
- `npm run lint`
- `npm run test:transliteration`
- `npm run test:transliteration:reverse`

## 13. Practical Notes For Agents

- Treat `mapping.ts` as the transliteration contract.
- Treat `useFlowStore.ts` as the source of truth for editor state and persistence.
- **Input Convention:** `Enter` is for newlines; `Shift+Enter` is for splitting blocks (available in `read` and `document` modes).
- **Rendering:** Vedic accents following a visarga are automatically separated by a ZWNJ in the engine for correct rendering.
- Treat `StickyTopComposer.tsx` as the top-half composer layout and output-target control surface.
- Treat `MainDocumentArea.tsx` as the lower read/review/immersive document surface.
- Compare mode in the lower area is intentionally disabled.
- When changing transliteration behavior, validate both forward and reverse paths.
- When changing editor behavior, watch caret preservation, line selection, and session persistence.
