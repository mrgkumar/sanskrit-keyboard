// app/src/store/useFlowStore.ts
import { create } from 'zustand';
import {
  CanonicalBlock,
  Segment,
  ChunkGroup,
  ChunkEditTarget,
  DisplaySettings,
  EditorState,
  ViewMode,
  LegacyTypographySettings,
  TypographySettings,
  SessionSnapshot,
  SessionListItem,
} from './types';
import { transliterate } from '@/lib/vedic/utils';
import {
  canonicalizeAcceptedInputToken,
  DEFAULT_OUTPUT_TARGET_SETTINGS,
  getDisplayMapping,
  getInputMappings,
  getOutputTargetSettingsFromLegacyOutputScheme,
  normalizeOutputTargetSettings,
  resolveLegacyOutputSchemeBridge,
  type InputScheme,
  type OutputScheme,
} from '@/lib/vedic/mapping';
import {
  applyLearnedSwaraVariants,
  accumulateExactFormUsageFromText,
  incrementExactFormUsage,
  getLexicalSuggestions,
  mergeLexicalSuggestionsWithSessionCounts,
  normalizeForLexicalLookup,
  preloadRuntimeLexiconAssets,
  shouldLookupLexicalSuggestions,
  type ExactFormUsageCounts,
  type LexicalUsageCounts,
  type LexicalSuggestion,
} from '@/lib/vedic/runtimeLexicon';

// --- UTILITY FUNCTIONS ---
// These functions might live here or in a separate file.

/**
 * A simple utility to segment a long source string.
 * In a real implementation, this would be much more sophisticated.
 */
const createSegments = (source: string): Segment[] => {
  const segments: Segment[] = [];
  let currentOffset = 0;
  let segmentId = 0;

  // Split by spaces and common punctuation (like danda '|' or '||')
  // This regex matches any sequence of word characters or any sequence of non-word characters (including spaces and punctuation)
  const delimiters = /(\s+|[.,;!?|]+)/;
  const parts = source.split(delimiters).filter(part => part.length > 0);

  let tempSegmentSource = '';
  let tempSegmentStartOffset = 0;

  const addCurrentSegment = () => {
    if (tempSegmentSource.length > 0) {
      segments.push({
        id: `seg-${segmentId++}`,
        source: tempSegmentSource,
        rendered: transliterate(tempSegmentSource).unicode,
        startOffset: tempSegmentStartOffset,
        endOffset: tempSegmentStartOffset + tempSegmentSource.length,
      });
      tempSegmentSource = '';
    }
  };

  for (const part of parts) {
    if (tempSegmentSource.length + part.length > 50 && tempSegmentSource.length > 0) {
      // If adding this part would make the segment too long, commit the current segment
      addCurrentSegment();
      tempSegmentStartOffset = currentOffset; // Start new segment at current offset
    } else if (tempSegmentSource.length === 0) {
      tempSegmentStartOffset = currentOffset; // Mark start of new segment
    }
    tempSegmentSource += part;
    currentOffset += part.length;
  }
  addCurrentSegment(); // Add any remaining part

  return segments;
};

const isLongBlockSource = (source: string) =>
  source.length > 100 || source.split(/[\s|]+/).filter(Boolean).length > 10;

const splitIntoBlockSources = (source: string): string[] =>
  source
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const getSessionStorageKey = (sessionId: string) => `sanskrit-keyboard.session.v2.${sessionId}`;

export const readStoredSessionSnapshot = (sessionId: string): SessionSnapshot | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(getSessionStorageKey(sessionId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionSnapshot;
  } catch (e) {
    console.error(`Failed to parse session ${sessionId}:`, e);
    return null;
  }
};

const createBlockFromSource = (
  source: string,
  title: string,
  options?: { disableAutoSegmentation?: boolean }
): CanonicalBlock => {
  const disableAutoSegmentation = options?.disableAutoSegmentation ?? false;
  const type = !disableAutoSegmentation && isLongBlockSource(source) ? 'long' : 'short';
  const block: CanonicalBlock = {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    disableAutoSegmentation,
    source,
    rendered: transliterate(source).unicode,
  };

  if (type === 'long') {
    block.segments = createSegments(source);
  }

  return block;
};


// --- MOCK DATA ---

const DEFAULT_BLOCK_SEEDS = [
  {
    id: 'block-1',
    title: 'Notation Sampler',
    source: "OM gaM gaNapataye nama: | so.aMsha: | a' a_ a'' | a.NgaM AyuuMM~'Si ||",
  },
  {
    id: 'block-2',
    title: 'Taittirīya Āraṇyaka Opening',
    source: 'taittiriiyaaraNyake prathamaprashnapraarambha: || hari: OM ||',
  },
  {
    id: 'block-3',
    title: 'Yajurveda Śānti',
    source: "shaM no' mitra:_ shaM varu'Na:| shaM no' bhavatvarya_maa|",
  },
  {
    id: 'block-4',
    title: 'Ṛgveda Opening',
    source: "a_gnimii'Le pu_rohi'taM ya_j~nasya' de_vamR^i_tvija'm| hotaaraM' ratna_dhaata'mam||",
  },
  {
    id: 'block-5',
    title: 'Sāmaveda Chant',
    source: "agna_ AyuuMM~'Si pavasa_ A su_vorja_miSaM' cha na:| A_re baadha'sva du_chChunaa'm||",
  },
  {
    id: 'block-6',
    title: 'Sāmaveda Accent Sample',
    source: "a2=gna3= A1= yaa2=hi vii3=ta1=ye2= gR^iNaa3=no2= ha3=vya1=daa2=taye| ni1= hotaa6= satsi ba3=rhi1=Si2= || 1 ||",
  },
] as const;

const INITIAL_BLOCKS: CanonicalBlock[] = DEFAULT_BLOCK_SEEDS.map(({ id, title, source }) => {
  const type = isLongBlockSource(source) ? 'long' : 'short';
  const block: CanonicalBlock = {
    id,
    type,
    title,
    source,
    rendered: transliterate(source).unicode,
  };

  if (type === 'long') {
    block.segments = createSegments(source);
  }

  return block;
});
const createBlankBlock = (): CanonicalBlock => ({
  id: `block-${Date.now()}`,
  type: 'short',
  title: 'Untitled Block',
  disableAutoSegmentation: true,
  source: '',
  rendered: '',
});
const LEGACY_DEFAULT_TYPOGRAPHY: LegacyTypographySettings = {
  itransFontSize: 18,
  itransLineHeight: 1.6,
  renderedFontSize: 32,
  renderedLineHeight: 1.7,
};
const DEFAULT_TYPOGRAPHY: TypographySettings = {
  composer: {
    ...LEGACY_DEFAULT_TYPOGRAPHY,
    devanagariFontSize: 27,
    tamilFontSize: 23,
    devanagariLineHeight: 1.6,
    tamilLineHeight: 1.8,
    itransFontSize: 18,
    itransLineHeight: 1.6,
    itransPanelHeight: 168,
    primaryPreviewHeight: 224,
    comparePreviewHeight: 224,
  },
  document: {
    itransFontSize: 18,
    devanagariFontSize: 27,
    tamilFontSize: 23,
    devanagariLineHeight: 1.8,
    tamilLineHeight: 1.8,
    itransLineHeight: 1.6,
    primaryPaneHeight: 480,
    comparePaneHeight: 480,
    renderedFontSize: 30,
    renderedLineHeight: 1.75,
  },
};
export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  composerLayout: 'side-by-side',
  syncComposerScroll: true,
  predictionLayout: 'listbox',
  predictionPopupTimeoutMs: 10000,
  inputScheme: 'canonical-vedic',
  outputScheme: 'canonical-vedic',
  ...DEFAULT_OUTPUT_TARGET_SETTINGS,
  sanskritFontPreset: 'chandas',
  tamilFontPreset: 'anek',
  autoSwapVisargaSvarita: true,
  showItransInDocument: false,
  referenceUsage: {},
  expandedCategories: ['Vowel', 'Consonant'],
  typography: DEFAULT_TYPOGRAPHY,
};

const SESSION_INDEX_KEY = 'sanskrit-keyboard.session-index.v2';

const sortSessionList = (sessions: SessionListItem[]) =>
  [...sessions].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

const readSessionIndex = (): SessionListItem[] => {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(SESSION_INDEX_KEY);
  if (!raw) return [];
  try {
    return sortSessionList(JSON.parse(raw) as SessionListItem[]);
  } catch {
    return [];
  }
};

const writeSessionIndex = (items: SessionListItem[]) => {
  if (typeof window === 'undefined') return items;
  const nextItems = sortSessionList(items).slice(0, 25);
  window.localStorage.setItem(SESSION_INDEX_KEY, JSON.stringify(nextItems));
  return nextItems;
};

const INITIAL_SESSION_ID = 'session-initial';
const INITIAL_SESSION_NAME = 'Current Session';
const createSessionId = () => `session-${Date.now()}`;
const createDefaultSessionName = () => {
  const now = new Date();
  return `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
const SESSION_LEXICAL_TOKEN_PATTERN = /[A-Za-z0-9\\^'"_~.=\/&#$]+/g;
const ACTIVE_BUFFER_PATTERN = /[A-Za-z0-9\\^'"_~.=\/&#$]+$/;
const COMMIT_DELIMITER_PATTERN = /[\s|.,;!?\n]/;
const DEFAULT_SWARA_PREDICTION_ENABLED = true;

const extractLexicalTokens = (source: string) =>
  source.match(SESSION_LEXICAL_TOKEN_PATTERN) ?? [];

export const incrementSessionLexicalUsage = (counts: LexicalUsageCounts, rawValue: string) => {
  const normalized = normalizeForLexicalLookup(rawValue);
  if (!shouldLookupLexicalSuggestions(normalized)) {
    return counts;
  }

  return {
    ...counts,
    [normalized]: (counts[normalized] ?? 0) + 1,
  };
};

export const accumulateSessionLexicalUsageFromText = (
  counts: LexicalUsageCounts,
  source: string
) => {
  let nextCounts = counts;
  const matches = extractLexicalTokens(source);

  for (const token of matches) {
    nextCounts = incrementSessionLexicalUsage(nextCounts, token);
  }

  return nextCounts;
};

export const accumulateSessionExactFormUsageFromText = (
  counts: ExactFormUsageCounts,
  source: string
) => accumulateExactFormUsageFromText(counts, extractLexicalTokens(source));

const deriveSessionLexicalUsageFromBlocks = (blocks: CanonicalBlock[]) => {
  let counts: LexicalUsageCounts = {};

  for (const block of blocks) {
    counts = accumulateSessionLexicalUsageFromText(counts, block.source);
  }

  return counts;
};

const deriveSessionExactFormUsageFromBlocks = (blocks: CanonicalBlock[]) => {
  let counts: ExactFormUsageCounts = {};

  for (const block of blocks) {
    counts = accumulateSessionExactFormUsageFromText(counts, block.source);
  }

  return counts;
};

const cloneTypographySettings = (settings: TypographySettings): TypographySettings => ({
  composer: { ...settings.composer },
  document: { ...settings.document },
});

const clampTypographyHeights = (settings: TypographySettings): TypographySettings => ({
  composer: {
    ...settings.composer,
    itransPanelHeight: Math.max(settings.composer.itransPanelHeight, 140),
    primaryPreviewHeight: Math.max(settings.composer.primaryPreviewHeight, 220),
    comparePreviewHeight: Math.max(settings.composer.comparePreviewHeight, 220),
  },
  document: {
    ...settings.document,
    primaryPaneHeight: Math.max(settings.document.primaryPaneHeight, 260),
    comparePaneHeight: Math.max(settings.document.comparePaneHeight, 260),
  },
});

export const normalizeDisplaySettings = (
  displaySettings?: DisplaySettings,
  legacyTypography?: LegacyTypographySettings
): DisplaySettings => {
  if (displaySettings) {
    const outputTargetSettings = normalizeOutputTargetSettings(displaySettings);
    const normalized: DisplaySettings = {
      composerLayout: displaySettings.composerLayout ?? DEFAULT_DISPLAY_SETTINGS.composerLayout,
      syncComposerScroll: displaySettings.syncComposerScroll ?? DEFAULT_DISPLAY_SETTINGS.syncComposerScroll,
      predictionLayout: displaySettings.predictionLayout ?? DEFAULT_DISPLAY_SETTINGS.predictionLayout,
      predictionPopupTimeoutMs:
        displaySettings.predictionPopupTimeoutMs ?? DEFAULT_DISPLAY_SETTINGS.predictionPopupTimeoutMs,
      inputScheme: displaySettings.inputScheme ?? DEFAULT_DISPLAY_SETTINGS.inputScheme,
      outputScheme: resolveLegacyOutputSchemeBridge(
        outputTargetSettings,
        displaySettings.outputScheme ?? DEFAULT_DISPLAY_SETTINGS.outputScheme,
      ),
      ...outputTargetSettings,
      sanskritFontPreset:
        displaySettings.sanskritFontPreset ?? DEFAULT_DISPLAY_SETTINGS.sanskritFontPreset,
      tamilFontPreset: displaySettings.tamilFontPreset ?? DEFAULT_DISPLAY_SETTINGS.tamilFontPreset,
      autoSwapVisargaSvarita:
        displaySettings.autoSwapVisargaSvarita ?? DEFAULT_DISPLAY_SETTINGS.autoSwapVisargaSvarita,
      showItransInDocument:
        displaySettings.showItransInDocument ?? DEFAULT_DISPLAY_SETTINGS.showItransInDocument,
      referenceUsage: displaySettings.referenceUsage ?? DEFAULT_DISPLAY_SETTINGS.referenceUsage,
      expandedCategories: displaySettings.expandedCategories ?? DEFAULT_DISPLAY_SETTINGS.expandedCategories,
      typography: {
        composer: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.composer,
          ...displaySettings.typography?.composer,
          devanagariFontSize:
            displaySettings.typography?.composer?.devanagariFontSize ??
            displaySettings.typography?.composer?.renderedFontSize ??
            DEFAULT_DISPLAY_SETTINGS.typography.composer.devanagariFontSize,
          tamilFontSize:
            displaySettings.typography?.composer?.tamilFontSize ??
            Math.max(
              (displaySettings.typography?.composer?.renderedFontSize ??
                DEFAULT_DISPLAY_SETTINGS.typography.composer.renderedFontSize) - 4,
              18
            ),
          devanagariLineHeight:
            displaySettings.typography?.composer?.devanagariLineHeight ??
            displaySettings.typography?.composer?.renderedLineHeight ??
            DEFAULT_DISPLAY_SETTINGS.typography.composer.devanagariLineHeight,
          tamilLineHeight:
            displaySettings.typography?.composer?.tamilLineHeight ??
            Math.max(
              displaySettings.typography?.composer?.renderedLineHeight ??
                DEFAULT_DISPLAY_SETTINGS.typography.composer.renderedLineHeight,
              DEFAULT_DISPLAY_SETTINGS.typography.composer.tamilLineHeight
            ),
        },
        document: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.document,
          ...displaySettings.typography?.document,
          devanagariFontSize:
            displaySettings.typography?.document?.devanagariFontSize ??
            displaySettings.typography?.document?.renderedFontSize ??
            DEFAULT_DISPLAY_SETTINGS.typography.document.devanagariFontSize,
          tamilFontSize:
            displaySettings.typography?.document?.tamilFontSize ??
            Math.max(
              (displaySettings.typography?.document?.renderedFontSize ??
                DEFAULT_DISPLAY_SETTINGS.typography.document.renderedFontSize) - 4,
              18
            ),
          devanagariLineHeight:
            displaySettings.typography?.document?.devanagariLineHeight ??
            displaySettings.typography?.document?.renderedLineHeight ??
            DEFAULT_DISPLAY_SETTINGS.typography.document.devanagariLineHeight,
          tamilLineHeight:
            displaySettings.typography?.document?.tamilLineHeight ??
            Math.max(
              displaySettings.typography?.document?.renderedLineHeight ??
                DEFAULT_DISPLAY_SETTINGS.typography.document.renderedLineHeight,
              DEFAULT_DISPLAY_SETTINGS.typography.document.tamilLineHeight
            ),
        },
      },
    };
    return {
      ...normalized,
      typography: clampTypographyHeights(normalized.typography),
    };
  }

  if (legacyTypography) {
    const legacyDisplaySettings: DisplaySettings = {
      ...DEFAULT_DISPLAY_SETTINGS,
      typography: {
        composer: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.composer,
          ...legacyTypography,
          devanagariFontSize: DEFAULT_DISPLAY_SETTINGS.typography.composer.devanagariFontSize,
          tamilFontSize: Math.max(DEFAULT_DISPLAY_SETTINGS.typography.composer.renderedFontSize - 4, 18),
          devanagariLineHeight: DEFAULT_DISPLAY_SETTINGS.typography.composer.renderedLineHeight,
          tamilLineHeight: DEFAULT_DISPLAY_SETTINGS.typography.composer.renderedLineHeight,
        },
        document: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.document,
          ...legacyTypography,
          devanagariFontSize: DEFAULT_DISPLAY_SETTINGS.typography.document.devanagariFontSize,
          tamilFontSize: Math.max(DEFAULT_DISPLAY_SETTINGS.typography.document.renderedFontSize - 4, 18),
          devanagariLineHeight: DEFAULT_DISPLAY_SETTINGS.typography.document.renderedLineHeight,
          tamilLineHeight: DEFAULT_DISPLAY_SETTINGS.typography.document.renderedLineHeight,
        },
      },
    };

    return {
      ...legacyDisplaySettings,
      typography: clampTypographyHeights(legacyDisplaySettings.typography),
    };
  }

  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    typography: clampTypographyHeights(cloneTypographySettings(DEFAULT_DISPLAY_SETTINGS.typography)),
  };
};

const shouldRecordCommittedBuffer = (activeBuffer: string, source: string, caret: number) => {
  if (!activeBuffer || caret <= 0) {
    return false;
  }

  const delimiter = source.slice(caret - 1, caret);
  return COMMIT_DELIMITER_PATTERN.test(delimiter);
};

export const canonicalizeCommittedEditorSource = (
  source: string,
  caret: number,
  committedBuffer: string,
  inputScheme: InputScheme = 'canonical-vedic'
) => {
  if (!committedBuffer || caret <= 0) {
    return {
      source,
      caret,
      canonicalBuffer: committedBuffer,
    };
  }

  const canonicalBuffer = canonicalizeAcceptedInputToken(committedBuffer, inputScheme);
  if (canonicalBuffer === committedBuffer) {
    return {
      source,
      caret,
      canonicalBuffer,
    };
  }

  const delimiterIndex = caret - 1;
  const tokenStart = delimiterIndex - committedBuffer.length;
  if (tokenStart < 0 || source.slice(tokenStart, delimiterIndex) !== committedBuffer) {
    return {
      source,
      caret,
      canonicalBuffer: committedBuffer,
    };
  }

  const nextSource =
    source.slice(0, tokenStart) +
    canonicalBuffer +
    source.slice(delimiterIndex);
  const delta = canonicalBuffer.length - committedBuffer.length;

  return {
    source: nextSource,
    caret: caret + delta,
    canonicalBuffer,
  };
};

const normalizeViewMode = (mode: ViewMode): ViewMode =>
  mode === 'review' ? 'read' : mode;

interface DeletedBlockSnapshot {
  block: CanonicalBlock;
  index: number;
}


// --- STORE DEFINITION ---

export interface SanskritKeyboardState {
  // Core Data
  blocks: CanonicalBlock[];
  editorState: EditorState;

  // Suggestion/Contextual Assist State
  activeBuffer: string;
  suggestions: { itrans: string; unicode: string }[];
  alternateSuggestions: { itrans: string; unicode: string }[];
  lexicalSuggestions: LexicalSuggestion[];
  lexicalQuery: string;
  isLexicalSuggestionsLoading: boolean;
  lexicalRequestSerial: number;
  lexicalSelectedSuggestionIndex: number;
  sessionLexicalUsage: LexicalUsageCounts;
  userLexicalUsage: LexicalUsageCounts;
  sessionExactFormUsage: ExactFormUsageCounts;
  userExactFormUsage: ExactFormUsageCounts;
  swaraPredictionEnabled: boolean;
  selectedSuggestionIndex: number;
  ghostText: string | null;
  composerSelectionStart: number;
  composerSelectionEnd: number;

  // UI State
  isReferencePanelOpen: boolean;
  deletedBuffer: string | null;
  displaySettings: DisplaySettings;
  sessionId: string;
  sessionName: string;
  sessionSearchQuery: string;
  savedSessions: SessionListItem[];
  lastSavedAt: string | null;
  recentlyDeletedBlock: DeletedBlockSnapshot | null;

  // Actions
  setActiveBlockId: (id: string | null) => void;
  setNextChunk: () => void;
  setPrevChunk: () => void;
  setFocusSpan: (span: 'tight' | 'balanced' | 'wide') => void;
  setViewMode: (mode: ViewMode) => void;
  activateBlockChunk: (blockId: string, segmentIndex?: number) => void;
  setActiveChunkIndex: (segmentIndex: number) => void;
  setNextBlock: () => void;
  setPrevBlock: () => void;
  updateChunkSource: (
    newSource: string,
    selectionStart?: number,
    selectionEnd?: number,
    editTarget?: ChunkEditTarget
  ) => void;
  toggleReferencePanel: () => void;
  addBlocks: (itransStrings: string[]) => void;
  mergeBlocks: (blockId: string, direction: 'previous' | 'next') => void;
  splitBlock: (blockId: string, sourceOffset: number) => void;
  deleteBlock: (id: string) => void;

  restoreDeletedBlock: () => void;
  dismissDeletedBlock: () => void;
  updateLexicalSuggestions: (prefix: string) => Promise<void>;
  clearLexicalSuggestions: () => void;
  setLexicalSelectedSuggestionIndex: (index: number) => void;
  recordSessionLexicalUse: (rawWord: string) => void;
  recordSessionLexicalText: (source: string) => void;
  setSwaraPredictionEnabled: (enabled: boolean) => void;
  hydratePersistedLexicalLearning: (payload: {
    userLexicalUsage?: LexicalUsageCounts;
    userExactFormUsage?: ExactFormUsageCounts;
    swaraPredictionEnabled?: boolean;
  }) => void;
  clearSessionLexicalLearning: () => void;
  clearPersistedLexicalLearning: () => void;
  preloadLexicalAssets: () => void;
  setDeletedBuffer: (char: string | null) => void;
  setComposerSelection: (start: number, end: number) => void;
  setComposerLayout: (layout: DisplaySettings['composerLayout']) => void;
  setSyncComposerScroll: (enabled: boolean) => void;
  setPredictionLayout: (layout: DisplaySettings['predictionLayout']) => void;
  setPredictionPopupTimeoutMs: (timeoutMs: number) => void;
  incrementReferenceUsage: (itrans: string) => void;
  toggleReferenceCategory: (category: string) => void;
  setInputScheme: (inputScheme: InputScheme) => void;
  setPrimaryOutputScript: (primaryOutputScript: DisplaySettings['primaryOutputScript']) => void;
  setComparisonOutputScript: (
    comparisonOutputScript: DisplaySettings['comparisonOutputScript']
  ) => void;
  setRomanOutputStyle: (romanOutputStyle: DisplaySettings['romanOutputStyle']) => void;
  setTamilOutputStyle: (tamilOutputStyle: DisplaySettings['tamilOutputStyle']) => void;
  setSanskritFontPreset: (sanskritFontPreset: DisplaySettings['sanskritFontPreset']) => void;
  setTamilFontPreset: (tamilFontPreset: DisplaySettings['tamilFontPreset']) => void;
  setAutoSwapVisargaSvarita: (enabled: boolean) => void;
  setShowItransInDocument: (enabled: boolean) => void;
  setOutputScheme: (outputScheme: OutputScheme) => void;
  setTypography: (
    scope: keyof TypographySettings,
    patch: Partial<TypographySettings[keyof TypographySettings]>
  ) => void;
  setSessionName: (name: string) => void;
  setSessionSearchQuery: (query: string) => void;
  setSavedSessions: (sessions: SessionListItem[]) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newName: string) => void;
  markSessionSaved: (savedAt?: string) => void;
  exportSessionSnapshot: () => SessionSnapshot;
  loadSessionSnapshot: (snapshot: SessionSnapshot) => void;
  resetSession: () => void;
  getRenderedDocumentText: () => string;

  // Selectors (for convenience)
  getActiveBlock: () => CanonicalBlock | undefined;
  getActiveChunkGroup: () => ChunkGroup | undefined;
}

export const useFlowStore = create<SanskritKeyboardState>((set, get) => ({
  // --- STATE ---
  blocks: INITIAL_BLOCKS,
  editorState: {
    activeBlockId: INITIAL_BLOCKS[0].id, // Default to first block
    activeAnchorSegmentIndex: 0,
    focusSpan: 'balanced',
    viewMode: 'read',
    ghostAssistEnabled: true,
  },
  activeBuffer: '',
  suggestions: [],
  alternateSuggestions: [],
  lexicalSuggestions: [],
  lexicalQuery: '',
  isLexicalSuggestionsLoading: false,
  lexicalRequestSerial: 0,
  lexicalSelectedSuggestionIndex: 0,
  sessionLexicalUsage: {},
  userLexicalUsage: {},
  sessionExactFormUsage: {},
  userExactFormUsage: {},
  swaraPredictionEnabled: DEFAULT_SWARA_PREDICTION_ENABLED,
  selectedSuggestionIndex: 0,
  ghostText: null,
  composerSelectionStart: 0,
  composerSelectionEnd: 0,
  isReferencePanelOpen: false, // Initialize here
  deletedBuffer: null, // Initialize here
  displaySettings: {
    ...DEFAULT_DISPLAY_SETTINGS,
    typography: cloneTypographySettings(DEFAULT_DISPLAY_SETTINGS.typography),
  },
  sessionId: INITIAL_SESSION_ID,
  sessionName: INITIAL_SESSION_NAME,
  sessionSearchQuery: '',
  savedSessions: readSessionIndex(),
  lastSavedAt: null,
  recentlyDeletedBlock: null,

  // --- ACTIONS ---
  setActiveBlockId: (id) => {
    set((state) => ({
      editorState: { ...state.editorState, activeBlockId: id, activeAnchorSegmentIndex: 0 },
    }));
  },
  toggleReferencePanel: () => {
    set((state) => ({ isReferencePanelOpen: !state.isReferencePanelOpen }));
  },
  setNextChunk: () => {
    const { getActiveBlock, editorState } = get();
    const activeBlock = getActiveBlock();
    if (!activeBlock || activeBlock.type === 'short' || !activeBlock.segments) return;

    const { activeAnchorSegmentIndex, focusSpan } = editorState;
    const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[focusSpan];
    const newAnchor = (activeAnchorSegmentIndex ?? 0) + segmentsPerGroup;

    if (newAnchor < activeBlock.segments.length) {
      set((state) => ({
        editorState: { ...state.editorState, activeAnchorSegmentIndex: newAnchor },
      }));
    }
  },
  setPrevChunk: () => {
    const { getActiveBlock, editorState } = get();
    const activeBlock = getActiveBlock();
    if (!activeBlock || activeBlock.type === 'short' || !activeBlock.segments) return;

    const { activeAnchorSegmentIndex, focusSpan } = editorState;
    const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[focusSpan];
    const newAnchor = (activeAnchorSegmentIndex ?? 0) - segmentsPerGroup;

    if (newAnchor >= 0) {
      set((state) => ({
        editorState: { ...state.editorState, activeAnchorSegmentIndex: newAnchor },
      }));
    }
  },
  setFocusSpan: (span) => {
    const { getActiveBlock, getActiveChunkGroup } = get();
    const activeBlock = getActiveBlock();
    const activeChunk = getActiveChunkGroup();

    if (!activeBlock || !activeBlock.segments || !activeChunk) {
      // If no active block or it's a short block, just set the focus span.
      // Orientation preservation only applies to long blocks with segments.
      set((state) => ({
        editorState: { ...state.editorState, focusSpan: span },
      }));
      return;
    }

    // Explicitly narrow the type of activeBlock for safer segment access
    const currentBlock = activeBlock as CanonicalBlock & { segments: Segment[] };

    // 1. Record the current textual position (start offset of the current active chunk)
    const currentTextOffset = currentBlock.segments[activeChunk.startSegmentIndex].startOffset;

    set((state) => {
      // Update the focus span first
      const newEditorState = { ...state.editorState, focusSpan: span };

      // Temporarily use the new focus span to find the new anchor
      const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[span];
      
      // Find the segment index that contains the currentTextOffset
      let newAnchorSegmentIndex = 0;
      for (let i = 0; i < currentBlock.segments.length; i++) {
        const segment = currentBlock.segments[i];
        if (currentTextOffset >= segment.startOffset && currentTextOffset <= segment.endOffset) {
          newAnchorSegmentIndex = i;
          break;
        }
      }

      // Adjust the newAnchorSegmentIndex to the start of its new chunk group
      newAnchorSegmentIndex = Math.floor(newAnchorSegmentIndex / segmentsPerGroup) * segmentsPerGroup;

      return {
        editorState: { ...newEditorState, activeAnchorSegmentIndex: newAnchorSegmentIndex },
      };
    });
  },
  setViewMode: (mode) => {
    set((state) => ({
      editorState: { ...state.editorState, viewMode: normalizeViewMode(mode) },
    }));
  },
  activateBlockChunk: (blockId, segmentIndex = 0) => {
    const block = get().blocks.find((item) => item.id === blockId);
    const boundedIndex =
      block && block.type === 'long' && block.segments
        ? Math.max(0, Math.min(segmentIndex, block.segments.length - 1))
        : 0;

    set((state) => ({
      editorState: {
        ...state.editorState,
        activeBlockId: blockId,
        activeAnchorSegmentIndex: boundedIndex,
      },
    }));
  },
  setActiveChunkIndex: (segmentIndex) => {
    const activeBlock = get().getActiveBlock();
    if (!activeBlock || activeBlock.type === 'short' || !activeBlock.segments) {
      return;
    }

    const boundedIndex = Math.max(0, Math.min(segmentIndex, activeBlock.segments.length - 1));
    set((state) => ({
      editorState: {
        ...state.editorState,
        activeAnchorSegmentIndex: boundedIndex,
      },
    }));
  },
  setNextBlock: () => {
    const { blocks, editorState } = get();
    const currentIndex = blocks.findIndex((block) => block.id === editorState.activeBlockId);
    if (currentIndex < 0 || currentIndex >= blocks.length - 1) {
      return;
    }

    const nextBlock = blocks[currentIndex + 1];
    set((state) => ({
      editorState: {
        ...state.editorState,
        activeBlockId: nextBlock.id,
        activeAnchorSegmentIndex: 0,
      },
    }));
  },
  setPrevBlock: () => {
    const { blocks, editorState } = get();
    const currentIndex = blocks.findIndex((block) => block.id === editorState.activeBlockId);
    if (currentIndex <= 0) {
      return;
    }

    const prevBlock = blocks[currentIndex - 1];
    set((state) => ({
      editorState: {
        ...state.editorState,
        activeBlockId: prevBlock.id,
        activeAnchorSegmentIndex: 0,
      },
    }));
  },
  updateChunkSource: (newSource, selectionStart, selectionEnd, editTarget) => {
    const { getActiveBlock, getActiveChunkGroup } = get();
    let activeBlock = getActiveBlock(); // Use 'let' because we might reassign it

    if (!activeBlock) return;
    const activeChunkGroup = getActiveChunkGroup();
    if (!activeChunkGroup) {
      return;
    }

    if (editTarget) {
      const isSameTarget =
        activeChunkGroup.blockId === editTarget.blockId &&
        activeChunkGroup.startSegmentIndex === editTarget.startSegmentIndex &&
        activeChunkGroup.endSegmentIndex === editTarget.endSegmentIndex &&
        activeChunkGroup.source === editTarget.source;

      if (!isSameTarget) {
        return;
      }
    }

    const previousActiveBuffer = get().activeBuffer;
    let nextSelectionStart = selectionStart ?? get().composerSelectionStart;
    let nextSelectionEnd = selectionEnd ?? nextSelectionStart;
    const inputScheme = get().displaySettings.inputScheme;
    const activeMappings = getInputMappings(inputScheme);
    const shouldCanonicalizeCommittedToken = shouldRecordCommittedBuffer(previousActiveBuffer, newSource, nextSelectionEnd);

    if (shouldCanonicalizeCommittedToken) {
      const canonicalized = canonicalizeCommittedEditorSource(
        newSource,
        nextSelectionEnd,
        previousActiveBuffer,
        inputScheme
      );
      newSource = canonicalized.source;
      nextSelectionStart = canonicalized.caret;
      nextSelectionEnd = canonicalized.caret;
    }

    // --- Auto-Swap Visarga/Svarita/Markers Logic ---
    if (get().displaySettings.autoSwapVisargaSvarita && nextSelectionEnd >= 2) {
      const sourceBefore = newSource.slice(0, nextSelectionEnd);
      const sourceAfter = newSource.slice(nextSelectionEnd);
      
      let swapped = false;
      let nextPrefix = '';

      // Check for 3-char patterns first
      if (nextSelectionEnd >= 3) {
        const lastThree = sourceBefore.slice(-3);
        if (lastThree === ":''") {
          nextPrefix = sourceBefore.slice(0, -3) + "'':";
          swapped = true;
        }
      }

      // Check for 2-char patterns if not already swapped
      if (!swapped) {
        const lastTwo = sourceBefore.slice(-2);
        if (lastTwo === ":'" || lastTwo === ":_" || lastTwo === ":\"") {
          const char = lastTwo[1];
          nextPrefix = sourceBefore.slice(0, -2) + char + ":";
          swapped = true;
        }
      }

      if (swapped) {
        newSource = nextPrefix + sourceAfter;
        // Keep caret at the same relative position (at the end of prefix)
      }
    }

    const isNowLong = isLongBlockSource(newSource);
    
    // --- Dynamic Short to Long Block Conversion ---
    if (activeBlock.type === 'short' && isNowLong && !activeBlock.disableAutoSegmentation) {
      const newSegments = createSegments(newSource);
      const newlyConvertedBlock: CanonicalBlock = { // Explicitly type the new block
        ...activeBlock,
        type: 'long',
        source: newSource,
        rendered: transliterate(newSource, { inputScheme }).unicode,
        segments: newSegments,
      };
      
      // Calculate new activeAnchorSegmentIndex to preserve orientation
      let newAnchorSegmentIndex = 0;
      let currentLength = 0;
      for (let i = 0; i < newSegments.length; i++) {
        currentLength += newSegments[i].source.length;
        if (currentLength >= newSource.length) { // Assuming cursor is at end of newSource
          newAnchorSegmentIndex = i;
          break;
        }
      }
      const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[get().editorState.focusSpan];
      newAnchorSegmentIndex = Math.floor(newAnchorSegmentIndex / segmentsPerGroup) * segmentsPerGroup;

      set((state) => ({
        blocks: state.blocks.map((block) =>
          block.id === newlyConvertedBlock.id ? newlyConvertedBlock : block
        ),
        editorState: {
          ...state.editorState,
          activeAnchorSegmentIndex: newAnchorSegmentIndex,
        },
      }));
      // Important: Update activeBlock to the newly converted one for subsequent logic within this function
      activeBlock = newlyConvertedBlock; 
    }
    
    // Now handle updates for blocks (either initially short, or already long, or newly converted long)
    if (activeBlock.type === 'short') { // It's a short block and remains short
      set((state) => ({
        blocks: state.blocks.map((block) =>
          block.id === activeBlock!.id // activeBlock is guaranteed here
            ? { ...block, source: newSource, rendered: transliterate(newSource, { inputScheme }).unicode }
            : block
        ),
        composerSelectionStart: nextSelectionStart,
        composerSelectionEnd: nextSelectionEnd,
      }));
    } else { // It's a long block (either was long, or just converted to long)
      if (!activeBlock.segments) return;

      const currentActiveBlock = activeBlock as CanonicalBlock & { segments: Segment[] };
      
      // 1. Reconstruct the full source by replacing the active chunk's range
      const beforeSegments = currentActiveBlock.segments.slice(0, activeChunkGroup.startSegmentIndex);
      const afterSegments = currentActiveBlock.segments.slice(activeChunkGroup.endSegmentIndex + 1);
      
      const beforeSource = beforeSegments.map(s => s.source).join('');
      const afterSource = afterSegments.map(s => s.source).join('');
      
      // newSource IS the entire content of the active chunk group
      const nextFullSource = beforeSource + newSource + afterSource;
      
      // 2. Re-segment and transliterate
      const nextSegments = createSegments(nextFullSource);
      const nextFullRendered = transliterate(nextFullSource, { inputScheme }).unicode;

      const nextBlocks = get().blocks.map(block => 
        block.id === activeBlock!.id 
          ? { ...block, source: nextFullSource, rendered: nextFullRendered, segments: nextSegments }
          : block
      );

      // 3. Update state
      set({
        blocks: nextBlocks,
        composerSelectionStart: nextSelectionStart,
        composerSelectionEnd: nextSelectionEnd,
        // We stay on the same anchor index, or adjust if needed.
        // For now, keeping the same start index is safest.
      });
    }

    // After updating the block (or after initial short block update), process suggestions for the new source
    const sourceBeforeCaret = newSource.slice(0, nextSelectionEnd);
    const wordsWithSpaces = sourceBeforeCaret.split(/(\s+)/);
    const lastWord = wordsWithSpaces[wordsWithSpaces.length - 1] || '';
    const activeBuffer = lastWord.match(ACTIVE_BUFFER_PATTERN)?.[0] || '';

    let completionMatches: typeof activeMappings = [];
    for (let len = Math.min(activeBuffer.length, 5); len > 0; len--) {
      const suffix = activeBuffer.slice(-len);
      const found = activeMappings.filter(m => m.itrans.startsWith(suffix) && m.itrans !== suffix);
      if (found.length > 0) {
        completionMatches = found;
        break;
      }
    }
    const suggestions = (
      completionMatches.length > 0
        ? completionMatches
        : activeMappings.filter(m => m.itrans.startsWith(activeBuffer) && activeBuffer.length > 0)
    )
      .map((mapping) => getDisplayMapping(mapping.itrans, get().displaySettings.primaryOutputScript) ?? mapping)
      .filter((mapping, index, list) => list.findIndex((entry) => entry.itrans === mapping.itrans) === index)
      .slice(0, 5)
      .map(({ itrans, unicode }) => ({ itrans, unicode }));

    const alternateSuggestions: { itrans: string; unicode: string }[] = [];
    const seen = new Set<string>();
    const addSuggestion = (sug: { itrans: string; unicode: string } | undefined) => {
      if (sug && !seen.has(sug.itrans)) {
        alternateSuggestions.push(sug);
        seen.add(sug.itrans);
      }
    };
    
    const getMapping = (itrans: string) => getDisplayMapping(itrans, get().displaySettings.primaryOutputScript) ?? activeMappings.find(m => m.itrans === itrans);

    activeMappings.filter(m => m.itrans === activeBuffer).forEach(addSuggestion);

    if (activeBuffer.length === 1 && activeBuffer.toLowerCase() !== activeBuffer.toUpperCase()) {
      addSuggestion(getMapping(activeBuffer.toLowerCase()));
      addSuggestion(getMapping(activeBuffer.toUpperCase()));
    }
    
    const svaraGroups = [
      ["'", "\\'"],
      ["_", "\\_"],
      ["''", '"']
    ];
    
    for (const group of svaraGroups) {
      if (group.includes(activeBuffer)) {
        group.forEach(itrans => addSuggestion(getMapping(itrans)));
        break;
      }
    }

    const ghostUnicode = alternateSuggestions[0]?.unicode || suggestions[0]?.unicode || null;

    set({ 
      activeBuffer, 
      suggestions, 
      alternateSuggestions, 
      ghostText: ghostUnicode,
      lexicalSelectedSuggestionIndex: 0,
      selectedSuggestionIndex: 0, // Reset selected suggestion index
      composerSelectionStart: nextSelectionStart,
      composerSelectionEnd: nextSelectionEnd,
    });
    if (shouldCanonicalizeCommittedToken) {
      get().recordSessionLexicalUse(canonicalizeAcceptedInputToken(previousActiveBuffer, inputScheme));
    }
    void get().updateLexicalSuggestions(activeBuffer);
  },
  addBlocks: (itransStrings: string[]) => {
    const newBlocks: CanonicalBlock[] = itransStrings
      .filter(str => str.trim().length > 0)
      .flatMap((itransSource) => splitIntoBlockSources(itransSource))
      .map((itransSource, index) =>
        createBlockFromSource(itransSource, `Pasted Block ${index + 1}`, {
          disableAutoSegmentation: true,
        })
      );

    if (newBlocks.length > 0) {
      set((state) => ({
        blocks:
          state.blocks.length === 1 &&
          state.blocks[0].source.trim().length === 0 &&
          state.blocks[0].rendered.trim().length === 0
            ? newBlocks
            : [...state.blocks, ...newBlocks],
        editorState: {
          ...state.editorState,
          activeBlockId: newBlocks[0].id, // Set first new block as active
          activeAnchorSegmentIndex: 0,
        },
        sessionLexicalUsage: deriveSessionLexicalUsageFromBlocks([
          ...state.blocks,
          ...newBlocks,
        ]),
        sessionExactFormUsage: deriveSessionExactFormUsageFromBlocks([
          ...state.blocks,
          ...newBlocks,
        ]),
      }));
    }
  },
  mergeBlocks: (blockId, direction) => {
    const { blocks, setComposerSelection, activateBlockChunk } = get();
    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'previous' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < blocks.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex === -1) return;

    const currentBlock = blocks[currentIndex];
    const targetBlock = blocks[targetIndex];

    const isPrev = direction === 'previous';
    const combinedSource = isPrev 
      ? targetBlock.source + currentBlock.source 
      : currentBlock.source + targetBlock.source;
    
    const caretPos = isPrev ? targetBlock.source.length : currentBlock.source.length;

    const mergedBlock = createBlockFromSource(combinedSource, targetBlock.title || currentBlock.title || '', {
      disableAutoSegmentation: true,
    });
    // Preserve ID of the one we are merging INTO
    mergedBlock.id = isPrev ? targetBlock.id : currentBlock.id;

    const nextBlocks = [...blocks];
    if (isPrev) {
      nextBlocks.splice(targetIndex, 2, mergedBlock);
    } else {
      nextBlocks.splice(currentIndex, 2, mergedBlock);
    }

    set({ 
      blocks: nextBlocks,
      sessionLexicalUsage: deriveSessionLexicalUsageFromBlocks(nextBlocks),
      sessionExactFormUsage: deriveSessionExactFormUsageFromBlocks(nextBlocks),
    });

    // Activate the merged block and set caret
    activateBlockChunk(mergedBlock.id, 0); // Activate first chunk
    
    // We need a small delay or use setComposerSelection directly if it's already active
    setTimeout(() => {
      setComposerSelection(caretPos, caretPos);
      const composer = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement | null;
      if (composer) {
        composer.focus();
        composer.setSelectionRange(caretPos, caretPos);
      }
    }, 50);
  },
  splitBlock: (blockId, sourceOffset) => {
    const { blocks, activateBlockChunk, setComposerSelection } = get();
    const currentIndex = blocks.findIndex((b) => b.id === blockId);
    if (currentIndex === -1) return;

    const block = blocks[currentIndex];
    const firstPart = block.source.slice(0, sourceOffset);
    const secondPart = block.source.slice(sourceOffset);

    // If secondPart is empty, it means we are splitting at the very end
    // which effectively just creates a new block after the current one.
    
    const block1 = createBlockFromSource(firstPart, block.title || 'Split Part 1', {
      disableAutoSegmentation: true,
    });
    const block2 = createBlockFromSource(secondPart, 'Untitled Block', {
      disableAutoSegmentation: true,
    });

    const nextBlocks = [...blocks];
    nextBlocks.splice(currentIndex, 1, block1, block2);

    set({ 
      blocks: nextBlocks,
      sessionLexicalUsage: deriveSessionLexicalUsageFromBlocks(nextBlocks),
      sessionExactFormUsage: deriveSessionExactFormUsageFromBlocks(nextBlocks),
    });

    // Activate the second block and set caret to start
    activateBlockChunk(block2.id, 0);
    
    setTimeout(() => {
      setComposerSelection(0, 0);
      const composer = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement | null;
      if (composer) {
        composer.focus();
        composer.setSelectionRange(0, 0);
      }
    }, 50);
  },
  deleteBlock: (blockId) => {
    const { blocks, editorState } = get();
    const targetId = blockId ?? editorState.activeBlockId;
    if (!targetId) {
      return;
    }

    const blockIndex = blocks.findIndex((block) => block.id === targetId);
    if (blockIndex === -1) {
      return;
    }

    const deletedBlock = blocks[blockIndex];

    if (blocks.length === 1) {
      const blankBlock = createBlankBlock();
      set((state) => ({
        blocks: [blankBlock],
        editorState: {
          ...state.editorState,
          activeBlockId: blankBlock.id,
          activeAnchorSegmentIndex: 0,
        },
        activeBuffer: '',
        suggestions: [],
        alternateSuggestions: [],
        lexicalSuggestions: [],
        lexicalQuery: '',
        isLexicalSuggestionsLoading: false,
        lexicalSelectedSuggestionIndex: 0,
        ghostText: null,
        composerSelectionStart: 0,
        composerSelectionEnd: 0,
        recentlyDeletedBlock: {
          block: deletedBlock,
          index: blockIndex,
        },
      }));
      return;
    }

    const nextBlocks = blocks.filter((block) => block.id !== targetId);
    const fallbackIndex = Math.min(blockIndex, nextBlocks.length - 1);
    const nextActiveBlock = nextBlocks[fallbackIndex];
    const shouldMoveFocus = editorState.activeBlockId === targetId;

    set((state) => ({
      blocks: nextBlocks,
      editorState: {
        ...state.editorState,
        activeBlockId: shouldMoveFocus ? nextActiveBlock.id : state.editorState.activeBlockId,
        activeAnchorSegmentIndex: 0,
      },
      activeBuffer: shouldMoveFocus ? '' : state.activeBuffer,
      suggestions: shouldMoveFocus ? [] : state.suggestions,
      alternateSuggestions: shouldMoveFocus ? [] : state.alternateSuggestions,
      lexicalSuggestions: shouldMoveFocus ? [] : state.lexicalSuggestions,
      lexicalQuery: shouldMoveFocus ? '' : state.lexicalQuery,
      isLexicalSuggestionsLoading: false,
      lexicalSelectedSuggestionIndex: shouldMoveFocus ? 0 : state.lexicalSelectedSuggestionIndex,
      ghostText: shouldMoveFocus ? null : state.ghostText,
      composerSelectionStart: 0,
      composerSelectionEnd: 0,
      sessionLexicalUsage: state.sessionLexicalUsage,
      sessionExactFormUsage: state.sessionExactFormUsage,
      recentlyDeletedBlock: {
        block: deletedBlock,
        index: blockIndex,
      },
    }));
  },
  restoreDeletedBlock: () => {
    const snapshot = get().recentlyDeletedBlock;
    if (!snapshot) {
      return;
    }

    set((state) => {
      const hasOnlyBlankBlock =
        state.blocks.length === 1 &&
        state.blocks[0].source.trim().length === 0 &&
        state.blocks[0].rendered.trim().length === 0;

      const baseBlocks = hasOnlyBlankBlock ? [] : state.blocks;
      const insertIndex = Math.max(0, Math.min(snapshot.index, baseBlocks.length));
      const restoredBlocks = [
        ...baseBlocks.slice(0, insertIndex),
        snapshot.block,
        ...baseBlocks.slice(insertIndex),
      ];

      return {
        blocks: restoredBlocks,
        editorState: {
          ...state.editorState,
          activeBlockId: snapshot.block.id,
          activeAnchorSegmentIndex: 0,
        },
        recentlyDeletedBlock: null,
      };
    });
  },
  dismissDeletedBlock: () => {
    set({ recentlyDeletedBlock: null });
  },
  updateLexicalSuggestions: async (prefix) => {
    const normalizedPrefix = normalizeForLexicalLookup(prefix);
    const nextSerial = get().lexicalRequestSerial + 1;

    if (!shouldLookupLexicalSuggestions(normalizedPrefix)) {
      set({
        lexicalSuggestions: [],
        lexicalQuery: normalizedPrefix,
        isLexicalSuggestionsLoading: false,
        lexicalRequestSerial: nextSerial,
        lexicalSelectedSuggestionIndex: 0,
      });
      return;
    }

    set({
      lexicalQuery: normalizedPrefix,
      isLexicalSuggestionsLoading: true,
      lexicalRequestSerial: nextSerial,
    });

    try {
      const baseSuggestions = await getLexicalSuggestions(normalizedPrefix, 8);
      if (get().lexicalRequestSerial !== nextSerial) {
        return;
      }

      const lexicalSuggestions = mergeLexicalSuggestionsWithSessionCounts({
        prefix: normalizedPrefix,
        baseSuggestions,
        sessionUsageCounts: get().sessionLexicalUsage,
        userUsageCounts: get().userLexicalUsage,
        limit: 5,
      });
      const withSwaraVariants = await applyLearnedSwaraVariants({
        suggestions: lexicalSuggestions,
        typedPrefix: prefix,
        enabled: get().swaraPredictionEnabled,
        sessionExactForms: get().sessionExactFormUsage,
        userExactForms: get().userExactFormUsage,
      });

      if (get().lexicalRequestSerial !== nextSerial) {
        return;
      }

      set({
        lexicalSuggestions: withSwaraVariants,
        lexicalQuery: normalizedPrefix,
        isLexicalSuggestionsLoading: false,
        lexicalSelectedSuggestionIndex: 0,
      });
    } catch {
      if (get().lexicalRequestSerial !== nextSerial) {
        return;
      }

      set({
        lexicalSuggestions: [],
        lexicalQuery: normalizedPrefix,
        isLexicalSuggestionsLoading: false,
        lexicalSelectedSuggestionIndex: 0,
      });
    }
  },
  clearLexicalSuggestions: () => {
    set((state) => ({
      lexicalSuggestions: [],
      lexicalQuery: '',
      isLexicalSuggestionsLoading: false,
      lexicalRequestSerial: state.lexicalRequestSerial + 1,
      lexicalSelectedSuggestionIndex: 0,
    }));
  },
  setLexicalSelectedSuggestionIndex: (index) => {
    set((state) => ({
      lexicalSelectedSuggestionIndex:
        state.lexicalSuggestions.length === 0
          ? 0
          : Math.max(0, Math.min(index, state.lexicalSuggestions.length - 1)),
    }));
  },
  recordSessionLexicalUse: (rawWord) => {
    set((state) => ({
      sessionLexicalUsage: incrementSessionLexicalUsage(state.sessionLexicalUsage, rawWord),
      userLexicalUsage: incrementSessionLexicalUsage(state.userLexicalUsage, rawWord),
      sessionExactFormUsage: incrementExactFormUsage(state.sessionExactFormUsage, rawWord),
      userExactFormUsage: incrementExactFormUsage(state.userExactFormUsage, rawWord),
    }));
  },
  recordSessionLexicalText: (source) => {
    set((state) => ({
      sessionLexicalUsage: accumulateSessionLexicalUsageFromText(state.sessionLexicalUsage, source),
      userLexicalUsage: accumulateSessionLexicalUsageFromText(state.userLexicalUsage, source),
      sessionExactFormUsage: accumulateSessionExactFormUsageFromText(state.sessionExactFormUsage, source),
      userExactFormUsage: accumulateSessionExactFormUsageFromText(state.userExactFormUsage, source),
    }));
  },
  setSwaraPredictionEnabled: (enabled) => {
    set({ swaraPredictionEnabled: enabled });
    void get().updateLexicalSuggestions(get().activeBuffer);
  },
  hydratePersistedLexicalLearning: (payload) => {
    set({
      userLexicalUsage: payload.userLexicalUsage ?? {},
      userExactFormUsage: payload.userExactFormUsage ?? {},
      swaraPredictionEnabled: payload.swaraPredictionEnabled ?? DEFAULT_SWARA_PREDICTION_ENABLED,
    });
  },
  clearSessionLexicalLearning: () => {
    set({
      sessionLexicalUsage: {},
      sessionExactFormUsage: {},
    });
    void get().updateLexicalSuggestions(get().activeBuffer);
  },
  clearPersistedLexicalLearning: () => {
    set({
      userLexicalUsage: {},
      userExactFormUsage: {},
    });
    void get().updateLexicalSuggestions(get().activeBuffer);
  },
  preloadLexicalAssets: () => {
    preloadRuntimeLexiconAssets(get().swaraPredictionEnabled);
  },
  setDeletedBuffer: (char: string | null) => {
    set({ deletedBuffer: char });
  },
  setComposerSelection: (start: number, end: number) => {
    set({ composerSelectionStart: start, composerSelectionEnd: end });
  },
  setComposerLayout: (composerLayout) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        composerLayout,
      },
    }));
  },
  setSyncComposerScroll: (syncComposerScroll) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        syncComposerScroll,
      },
    }));
  },
  setPredictionLayout: (predictionLayout) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        predictionLayout,
      },
    }));
  },
  setPredictionPopupTimeoutMs: (predictionPopupTimeoutMs) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        predictionPopupTimeoutMs,
      },
    }));
  },
  incrementReferenceUsage: (itrans) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        referenceUsage: {
          ...state.displaySettings.referenceUsage,
          [itrans]: (state.displaySettings.referenceUsage[itrans] ?? 0) + 1,
        },
      },
    }));
  },
  toggleReferenceCategory: (category) => {
    set((state) => {
      const isExpanded = state.displaySettings.expandedCategories.includes(category);
      const nextExpanded = isExpanded
        ? state.displaySettings.expandedCategories.filter((c) => c !== category)
        : [...state.displaySettings.expandedCategories, category];

      return {
        displaySettings: {
          ...state.displaySettings,
          expandedCategories: nextExpanded,
        },
      };
    });
  },
  setInputScheme: (inputScheme) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        inputScheme,
      },
      suggestions: [],
      alternateSuggestions: [],
      ghostText: null,
      blocks: state.blocks.map((block) => ({
        ...block,
        rendered: transliterate(block.source, { inputScheme }).unicode,
        segments:
          block.type === 'long' && block.segments
            ? block.segments.map((segment) => ({
                ...segment,
                rendered: transliterate(segment.source, { inputScheme }).unicode,
              }))
            : block.segments,
      })),
    }));
  },
  setPrimaryOutputScript: (primaryOutputScript) => {
    set((state) => {
      const nextOutputTargetSettings = {
        primaryOutputScript,
        comparisonOutputScript: state.displaySettings.comparisonOutputScript,
        romanOutputStyle: state.displaySettings.romanOutputStyle,
        tamilOutputStyle: state.displaySettings.tamilOutputStyle,
      };

      return {
        displaySettings: {
          ...state.displaySettings,
          ...nextOutputTargetSettings,
          outputScheme: resolveLegacyOutputSchemeBridge(
            nextOutputTargetSettings,
            state.displaySettings.outputScheme,
          ),
        },
      };
    });
  },
  setComparisonOutputScript: (comparisonOutputScript) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        comparisonOutputScript,
      },
    }));
  },
  setRomanOutputStyle: (romanOutputStyle) => {
    set((state) => {
      const nextOutputTargetSettings = {
        primaryOutputScript: state.displaySettings.primaryOutputScript,
        comparisonOutputScript: state.displaySettings.comparisonOutputScript,
        romanOutputStyle,
        tamilOutputStyle: state.displaySettings.tamilOutputStyle,
      };

      return {
        displaySettings: {
          ...state.displaySettings,
          ...nextOutputTargetSettings,
          outputScheme: resolveLegacyOutputSchemeBridge(
            nextOutputTargetSettings,
            state.displaySettings.outputScheme,
          ),
        },
      };
    });
  },
  setTamilOutputStyle: (tamilOutputStyle) => {
    set((state) => {
      const nextOutputTargetSettings = {
        primaryOutputScript: state.displaySettings.primaryOutputScript,
        comparisonOutputScript: state.displaySettings.comparisonOutputScript,
        romanOutputStyle: state.displaySettings.romanOutputStyle,
        tamilOutputStyle,
      };

      return {
        displaySettings: {
          ...state.displaySettings,
          ...nextOutputTargetSettings,
          outputScheme: resolveLegacyOutputSchemeBridge(
            nextOutputTargetSettings,
            state.displaySettings.outputScheme,
          ),
        },
      };
    });
  },
  setSanskritFontPreset: (sanskritFontPreset) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        sanskritFontPreset,
      },
    }));
  },
  setTamilFontPreset: (tamilFontPreset) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        tamilFontPreset,
      },
    }));
  },
  setAutoSwapVisargaSvarita: (enabled) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        autoSwapVisargaSvarita: enabled,
      },
    }));
  },
  setShowItransInDocument: (enabled) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        showItransInDocument: enabled,
      },
    }));
  },
  setOutputScheme: (outputScheme) => {
    const outputTargetSettings = getOutputTargetSettingsFromLegacyOutputScheme(outputScheme);
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        outputScheme,
        ...outputTargetSettings,
      },
    }));
  },
  setTypography: (scope, patch) => {
    set((state) => ({
      displaySettings: {
        ...state.displaySettings,
        typography: {
          ...state.displaySettings.typography,
          [scope]: {
            ...state.displaySettings.typography[scope],
            ...patch,
          },
        },
      },
    }));
  },
  setSessionName: (name) => {
    set({ sessionName: name });
    // Also update the index if it exists
    const index = readSessionIndex();
    const sessionId = get().sessionId;
    const itemIndex = index.findIndex(item => item.sessionId === sessionId);
    if (itemIndex !== -1) {
      index[itemIndex].sessionName = name;
      const nextIndex = writeSessionIndex(index);
      set({ savedSessions: nextIndex });
    }
  },
  setSessionSearchQuery: (query) => {
    set({ sessionSearchQuery: query });
  },
  setSavedSessions: (sessions) => {
    set({ savedSessions: sessions });
  },
  deleteSession: (sessionId) => {
    const { sessionId: currentSessionId, resetSession } = get();
    
    // 1. Remove from index
    const index = readSessionIndex();
    const nextIndex = writeSessionIndex(index.filter(item => item.sessionId !== sessionId));
    set({ savedSessions: nextIndex });

    // 2. Remove data
    window.localStorage.removeItem(getSessionStorageKey(sessionId));

    // 3. If it was the current session, reset
    if (sessionId === currentSessionId) {
      resetSession();
    }
  },
  renameSession: (sessionId, newName) => {
    const { sessionId: currentSessionId } = get();
    
    // 1. Update index
    const index = readSessionIndex();
    const itemIndex = index.findIndex(item => item.sessionId === sessionId);
    if (itemIndex !== -1) {
      index[itemIndex].sessionName = newName;
      index[itemIndex].updatedAt = new Date().toISOString();
      const nextIndex = writeSessionIndex(index);
      set({ savedSessions: nextIndex });
    }

    // 2. If it is current session, update state
    if (sessionId === currentSessionId) {
      set({ sessionName: newName });
    }

    // 3. Update the stored snapshot as well to keep it consistent
    const snapshotRaw = window.localStorage.getItem(getSessionStorageKey(sessionId));
    if (snapshotRaw) {
      try {
        const snapshot = JSON.parse(snapshotRaw) as SessionSnapshot;
        snapshot.sessionName = newName;
        snapshot.updatedAt = new Date().toISOString();
        window.localStorage.setItem(getSessionStorageKey(sessionId), JSON.stringify(snapshot));
      } catch {
        // Ignore parse errors for renaming
      }
    }
  },
  markSessionSaved: (savedAt) => {
    const nextSavedAt = savedAt ?? new Date().toISOString();
    set({ lastSavedAt: nextSavedAt });
    const { sessionId, exportSessionSnapshot } = get();
    const snapshot = exportSessionSnapshot();
    snapshot.updatedAt = nextSavedAt;

    // Keep the durable snapshot and the session index in sync.
    window.localStorage.setItem(getSessionStorageKey(sessionId), JSON.stringify(snapshot));

    const index = readSessionIndex();
    const existingIndex = index.findIndex(item => item.sessionId === sessionId);
    
    if (existingIndex !== -1) {
      index[existingIndex].updatedAt = nextSavedAt;
      index[existingIndex].sessionName = snapshot.sessionName;
    } else {
      index.push({ sessionId, sessionName: snapshot.sessionName, updatedAt: nextSavedAt });
    }
    const nextIndex = writeSessionIndex(index);
    set({ savedSessions: nextIndex });
  },
  exportSessionSnapshot: () => {
    const {
      blocks,
      editorState,
      displaySettings,
      sessionId,
      sessionName,
      lastSavedAt,
    } = get();

    return {
      sessionId,
      sessionName: sessionName.trim() || createDefaultSessionName(),
      blocks,
      editorState,
      displaySettings: {
        ...displaySettings,
        typography: cloneTypographySettings(displaySettings.typography),
      },
      updatedAt: lastSavedAt ?? new Date().toISOString(),
    };
  },
  loadSessionSnapshot: (snapshot) => {
    set({
      blocks: snapshot.blocks,
      editorState: {
        ...snapshot.editorState,
        viewMode: normalizeViewMode(snapshot.editorState.viewMode),
      },
      displaySettings: normalizeDisplaySettings(snapshot.displaySettings, snapshot.typography),
      sessionId: snapshot.sessionId,
      sessionName: snapshot.sessionName,
      lastSavedAt: snapshot.updatedAt,
      composerSelectionStart: 0,
      composerSelectionEnd: 0,
      deletedBuffer: null,
      isReferencePanelOpen: false,
      lexicalSuggestions: [],
      lexicalQuery: '',
      isLexicalSuggestionsLoading: false,
      lexicalRequestSerial: 0,
      lexicalSelectedSuggestionIndex: 0,
      sessionLexicalUsage: deriveSessionLexicalUsageFromBlocks(snapshot.blocks),
      sessionExactFormUsage: deriveSessionExactFormUsageFromBlocks(snapshot.blocks),
      recentlyDeletedBlock: null,
    });
  },
  resetSession: () => {
    const blankBlock = createBlankBlock();
    set({
      blocks: [blankBlock],
      editorState: {
        activeBlockId: blankBlock.id,
        activeAnchorSegmentIndex: 0,
        focusSpan: 'balanced',
        viewMode: 'read',
        ghostAssistEnabled: true,
      },
      activeBuffer: '',
      suggestions: [],
      alternateSuggestions: [],
      lexicalSuggestions: [],
      lexicalQuery: '',
      isLexicalSuggestionsLoading: false,
      lexicalRequestSerial: 0,
      lexicalSelectedSuggestionIndex: 0,
      sessionLexicalUsage: {},
      sessionExactFormUsage: {},
      selectedSuggestionIndex: 0,
      ghostText: null,
      composerSelectionStart: 0,
      composerSelectionEnd: 0,
      isReferencePanelOpen: false,
      deletedBuffer: null,
      displaySettings: {
        ...DEFAULT_DISPLAY_SETTINGS,
        typography: cloneTypographySettings(DEFAULT_DISPLAY_SETTINGS.typography),
      },
      sessionId: createSessionId(),
      sessionName: createDefaultSessionName(),
      lastSavedAt: null,
      recentlyDeletedBlock: null,
    });
  },
  getRenderedDocumentText: () => {
    const { blocks } = get();
    return blocks
      .map((block) => block.rendered.trim())
      .filter((rendered) => rendered.length > 0)
      .join('\n\n');
  },


  // --- SELECTORS ---
  getActiveBlock: () => {
    const { blocks, editorState } = get();
    return blocks.find(b => b.id === editorState.activeBlockId);
  },

  getActiveChunkGroup: () => {
    const activeBlock = get().getActiveBlock();
    const { activeAnchorSegmentIndex, focusSpan } = get().editorState;

    if (!activeBlock || activeBlock.type === 'short' || !activeBlock.segments) {
      // For short blocks, the "chunk group" is the block itself.
      return activeBlock ? { 
        startSegmentIndex: 0,
        endSegmentIndex: 0,
        source: activeBlock.source,
        rendered: activeBlock.rendered,
        blockId: activeBlock.id,
      } : undefined;
    }

    const segmentsPerGroup = { tight: 1, balanced: 2, wide: 3 }[focusSpan];
    const anchor = activeAnchorSegmentIndex ?? 0;
    
    // Find which group the anchor belongs to
    const groupNum = Math.floor(anchor / segmentsPerGroup);
    const startSegmentIndex = groupNum * segmentsPerGroup;
    const endSegmentIndex = Math.min(startSegmentIndex + segmentsPerGroup - 1, activeBlock.segments.length - 1);

    const relevantSegments = activeBlock.segments.slice(startSegmentIndex, endSegmentIndex + 1);
    const source = relevantSegments.map(s => s.source).join('');

    return {
      startSegmentIndex,
      endSegmentIndex,
      source,
      rendered: transliterate(source, { inputScheme: get().displaySettings.inputScheme }).unicode,
      blockId: activeBlock.id,
    };
  },
}));
