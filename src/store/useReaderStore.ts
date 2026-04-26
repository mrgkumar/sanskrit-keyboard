'use client';

import { create } from 'zustand';
import type {
  MantraDocument,
  ReaderDisplayScript,
  ReaderMode,
  ReaderPreferences,
  ReaderTheme,
  VedaManifest,
} from '@/lib/veda-book/types';
import { DEFAULT_READER_PREFERENCES } from '@/lib/veda-book/types';
import { READER_PREFERENCES_STORAGE_KEY } from '@/lib/veda-book/constants';
import { buildManifestFromMantrasTex } from '@/lib/veda-book/buildManifest';
import {
  getCachedManifest,
  getCachedParsedDocument,
  getCachedRawDocument,
  setCachedManifest,
  setCachedParsedDocument,
  setCachedRawDocument,
} from '@/lib/veda-book/cache';
import { fetchRawTex } from '@/lib/veda-book/fetchSource';
import { parseTexDocument } from '@/lib/veda-book/parseTex';
import { deriveDocumentTitleFromNodes } from '@/lib/veda-book/renderText';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

interface ReaderStoreState extends ReaderPreferences {
  manifest: VedaManifest | null;
  manifestStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  manifestError: string | null;
  documentsByPath: Record<string, MantraDocument>;
  activePath: string | null;
  activeDocument: MantraDocument | null;
  documentStatus: 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';
  documentError: string | null;
  setReaderMode: (mode: ReaderMode) => void;
  setDisplayScript: (displayScript: ReaderDisplayScript) => void;
  setSanskritFontPreset: (preset: SanskritFontPreset) => void;
  setTamilFontPreset: (preset: TamilFontPreset) => void;
  setTheme: (theme: ReaderTheme) => void;
  setTypography: (settings: { fontSize?: number; lineHeight?: number }) => void;
  setSidebarOpen: (open: boolean) => void;
  setDiagnosticsOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  loadManifest: (options?: { force?: boolean }) => Promise<void>;
  refreshManifest: () => Promise<void>;
  openDocument: (path: string, options?: { force?: boolean }) => Promise<void>;
  clearReaderError: () => void;
}

const hasWindow = () => typeof window !== 'undefined';

const readStoredPreferences = (): ReaderPreferences => {
  if (!hasWindow()) {
    return DEFAULT_READER_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(READER_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_READER_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as Partial<ReaderPreferences>;
    return {
      ...DEFAULT_READER_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_READER_PREFERENCES;
  }
};

const persistPreferences = (preferences: ReaderPreferences) => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(READER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
};

const selectPreferences = (state: Pick<
  ReaderStoreState,
  'readerMode' | 'displayScript' | 'theme' | 'fontSize' | 'lineHeight' | 'sidebarOpen' | 'diagnosticsOpen' | 'searchQuery'
  | 'sanskritFontPreset'
  | 'tamilFontPreset'
>) => ({
  readerMode: state.readerMode,
  displayScript: state.displayScript,
  sanskritFontPreset: state.sanskritFontPreset,
  tamilFontPreset: state.tamilFontPreset,
  theme: state.theme,
  fontSize: state.fontSize,
  lineHeight: state.lineHeight,
  sidebarOpen: state.sidebarOpen,
  diagnosticsOpen: state.diagnosticsOpen,
  searchQuery: state.searchQuery,
});

const upsertDocument = (
  documentsByPath: Record<string, MantraDocument>,
  document: MantraDocument,
) => ({
  ...documentsByPath,
  [document.sourcePath]: document,
});

const updateManifestEntryTitle = (manifest: VedaManifest | null, path: string, title: string) => {
  if (!manifest) {
    return null;
  }

  const existing = manifest.entries.find((entry) => entry.path === path);
  if (!existing || existing.title === title) {
    return manifest;
  }

  return {
    ...manifest,
    entries: manifest.entries.map((entry) => (entry.path === path ? { ...entry, title } : entry)),
  };
};

const fallbackTitleFromPath = (path: string) =>
  path.split('/').pop()?.replace(/\.tex$/i, '') ?? path;

export const useReaderStore = create<ReaderStoreState>((set, get) => {
  const initialPreferences = readStoredPreferences();

  return {
    ...initialPreferences,
    manifest: null,
    manifestStatus: 'idle',
    manifestError: null,
    documentsByPath: {},
    activePath: null,
    activeDocument: null,
    documentStatus: 'idle',
    documentError: null,
    setReaderMode: (readerMode) => {
      set({ readerMode });
      persistPreferences(selectPreferences(get()));
    },
    setDisplayScript: (displayScript) => {
      set({ displayScript });
      persistPreferences(selectPreferences(get()));
    },
    setSanskritFontPreset: (sanskritFontPreset) => {
      set({ sanskritFontPreset });
      persistPreferences(selectPreferences(get()));
    },
    setTamilFontPreset: (tamilFontPreset) => {
      set({ tamilFontPreset });
      persistPreferences(selectPreferences(get()));
    },
    setTheme: (theme) => {
      set({ theme });
      persistPreferences(selectPreferences(get()));
    },
    setTypography: ({ fontSize, lineHeight }) => {
      const nextFontSize = fontSize ?? get().fontSize;
      const nextLineHeight = lineHeight ?? get().lineHeight;
      set({
        fontSize: nextFontSize,
        lineHeight: nextLineHeight,
      });
      persistPreferences(selectPreferences(get()));
    },
    setSidebarOpen: (sidebarOpen) => {
      set({ sidebarOpen });
      persistPreferences(selectPreferences(get()));
    },
    setDiagnosticsOpen: (diagnosticsOpen) => {
      set({ diagnosticsOpen });
      persistPreferences(selectPreferences(get()));
    },
    setSearchQuery: (searchQuery) => {
      set({ searchQuery });
      persistPreferences(selectPreferences(get()));
    },
    loadManifest: async (options) => {
      const cachedManifest = options?.force ? null : await getCachedManifest();
      if (cachedManifest) {
        set({
          manifest: cachedManifest,
          manifestStatus: 'ready',
          manifestError: null,
        });

        void get()
          .refreshManifest()
          .catch(() => undefined);
        return;
      }

      set({
        manifestStatus: 'loading',
        manifestError: null,
      });

      try {
        const manifest = await buildManifestFromMantrasTex({ force: options?.force });
        set({
          manifest,
          manifestStatus: 'ready',
          manifestError: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load manifest.';
        set({
          manifestStatus: 'error',
          manifestError: message,
        });
      }
    },
    refreshManifest: async () => {
      set({ manifestStatus: 'refreshing', manifestError: null });

      try {
        const manifest = await buildManifestFromMantrasTex({ force: true });
        set({
          manifest,
          manifestStatus: 'ready',
          manifestError: null,
        });

        const activePath = get().activePath;
        if (activePath) {
          await get().openDocument(activePath, { force: true });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to refresh manifest.';
        set((state) => ({
          manifestStatus: state.manifest ? 'ready' : 'error',
          manifestError: state.manifest ? null : message,
        }));
      }
    },
    openDocument: async (path, options) => {
      set({
        activePath: path,
        documentStatus: options?.force ? 'refreshing' : 'loading',
        documentError: null,
      });

      try {
        if (!options?.force) {
          const cachedParsed = await getCachedParsedDocument(path);
          if (cachedParsed) {
            const resolvedTitle = deriveDocumentTitleFromNodes(
              cachedParsed.nodes,
              cachedParsed.title || fallbackTitleFromPath(path),
            );
            const normalizedDocument =
              resolvedTitle === cachedParsed.title
                ? cachedParsed
                : {
                    ...cachedParsed,
                    title: resolvedTitle,
                  };

            set((state) => ({
              activeDocument: normalizedDocument,
              documentsByPath: upsertDocument(state.documentsByPath, normalizedDocument),
              documentStatus: 'ready',
              documentError: null,
              manifest: updateManifestEntryTitle(state.manifest, path, resolvedTitle) ?? state.manifest,
            }));

            if (resolvedTitle !== cachedParsed.title) {
              const nextManifest = updateManifestEntryTitle(get().manifest, path, resolvedTitle);
              if (nextManifest) {
                set({ manifest: nextManifest });
                void setCachedManifest(nextManifest);
              }
              void setCachedParsedDocument(normalizedDocument);
            }
            return;
          }
        }

        const cachedRaw = options?.force ? null : await getCachedRawDocument(path);
        const rawTex =
          cachedRaw?.rawTex ?? (await fetchRawTex(path, { force: options?.force }));
        const parsed = parseTexDocument(rawTex, { sourcePath: path });
        const fallbackTitle =
          get().manifest?.entries.find((entry) => entry.path === path)?.title ?? fallbackTitleFromPath(path);
        const resolvedTitle = deriveDocumentTitleFromNodes(parsed.nodes, fallbackTitle);
        const document: MantraDocument = {
          id: path,
          title: resolvedTitle,
          sourceRepo: get().manifest?.sourceRepo ?? 'stotrasamhita/vedamantra-book',
          sourceBranch: get().manifest?.branch ?? 'master',
          sourcePath: path,
          rawTex,
          nodes: parsed.nodes,
          diagnostics: parsed.diagnostics,
          fetchedAt: new Date().toISOString(),
        };

        await Promise.all([
          setCachedRawDocument({
            key: path,
            path,
            rawTex,
            fetchedAt: document.fetchedAt,
            sourceRepo: document.sourceRepo,
            branch: document.sourceBranch,
            sourceSha: document.sourceSha,
          }),
          setCachedParsedDocument(document),
        ]);

        set((state) => ({
          activeDocument: document,
          documentsByPath: upsertDocument(state.documentsByPath, document),
          documentStatus: 'ready',
          documentError: null,
          manifest: updateManifestEntryTitle(state.manifest, path, resolvedTitle) ?? state.manifest,
        }));

        const nextManifest = updateManifestEntryTitle(get().manifest, path, resolvedTitle);
        if (nextManifest) {
          void setCachedManifest(nextManifest);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : `Unable to load ${path}.`;
        set((state) => ({
          documentStatus: state.activeDocument ? 'ready' : 'error',
          documentError: state.activeDocument ? null : message,
        }));
      }
    },
    clearReaderError: () => {
      set({
        manifestError: null,
        documentError: null,
      });
    },
  };
});
