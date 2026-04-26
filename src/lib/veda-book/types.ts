import type { OutputScript } from '@/lib/vedic/mapping';
import type { SanskritFontPreset, TamilFontPreset } from '@/store/types';

export type ReaderMode = 'reader' | 'source' | 'split' | 'compare';
export type ReaderTheme = 'light' | 'sepia' | 'dark';
export type ReaderDisplayScript = 'original' | OutputScript;
export type LoadStatus = 'idle' | 'loading' | 'ready' | 'refreshing' | 'error';

export type ParserDiagnosticLevel = 'info' | 'warning' | 'error';

export interface ParserDiagnostic {
  id: string;
  level: ParserDiagnosticLevel;
  message: string;
  source?: string;
  line?: number;
  column?: number;
  nodeId?: string;
}

export type MantraNode =
  | { type: 'chapter'; id: string; text: string }
  | { type: 'section'; id: string; text: string }
  | { type: 'subsection'; id: string; text: string }
  | { type: 'paragraph'; id: string; text: string }
  | { type: 'center'; id: string; text: string }
  | { type: 'sourceRef'; id: string; source: 'TA' | 'TB' | 'TS'; values: string[] }
  | { type: 'pageBreak'; id: string }
  | { type: 'raw'; id: string; text: string }
  | { type: 'warning'; id: string; message: string; source?: string };

export interface MantraDocument {
  id: string;
  title: string;
  sourceRepo: string;
  sourceBranch: string;
  sourcePath: string;
  rawTex: string;
  nodes: MantraNode[];
  diagnostics: ParserDiagnostic[];
  fetchedAt: string;
  sourceSha?: string;
}

export interface VedaManifestEntry {
  id: string;
  path: string;
  title: string;
  category: string;
  order: number;
  sourceRepo: string;
  branch: string;
}

export interface VedaManifest {
  sourceRepo: string;
  branch: string;
  builtAt: string;
  entries: VedaManifestEntry[];
  sourceSha?: string;
}

export interface ReaderPreferences {
  readerMode: ReaderMode;
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  displayScript: ReaderDisplayScript;
  sanskritFontPreset: SanskritFontPreset;
  tamilFontPreset: TamilFontPreset;
  sidebarOpen: boolean;
  diagnosticsOpen: boolean;
  searchQuery: string;
}

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  readerMode: 'reader',
  theme: 'sepia',
  fontSize: 19,
  lineHeight: 1.75,
  displayScript: 'original',
  sanskritFontPreset: 'siddhanta',
  tamilFontPreset: 'anek',
  sidebarOpen: true,
  diagnosticsOpen: false,
  searchQuery: '',
};
