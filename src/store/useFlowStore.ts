// app/src/store/useFlowStore.ts
import { create } from 'zustand';
import {
  CanonicalBlock,
  Segment,
  ChunkGroup,
  ChunkEditTarget,
  DisplaySettings,
  EditorState,
  LegacyTypographySettings,
  TypographySettings,
  SessionSnapshot,
} from './types';
import { transliterate } from '@/lib/vedic/utils';
import { MAPPING_TRIE } from '@/lib/vedic/mapping';
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

const MOCK_SHORT_BLOCK: CanonicalBlock = {
  id: 'block-1',
  type: 'short',
  title: 'Gaṇeśa Mantra',
  source: 'oM gaM gaNapataye nama:',
  rendered: transliterate('oM gaM gaNapataye nama:').unicode,
};

const LONG_SOURCE = "oM saha nAvavatu | saha nau bhunaktu | saha vIryaM karavAvahai | tejasvi nAvadhItamastu mA vidviShAvahai || oM shAnti: shAnti: shAnti: ||";
const MOCK_LONG_BLOCK: CanonicalBlock = {
  id: 'block-2',
  type: 'long',
  title: 'Śānti Mantra',
  source: LONG_SOURCE,
  rendered: transliterate(LONG_SOURCE).unicode,
  segments: createSegments(LONG_SOURCE), // Segmenting the long source
};

const INITIAL_BLOCKS = [MOCK_SHORT_BLOCK, MOCK_LONG_BLOCK];
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
  },
  document: {
    itransFontSize: 16,
    itransLineHeight: 1.6,
    renderedFontSize: 30,
    renderedLineHeight: 1.75,
  },
};
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  composerLayout: 'side-by-side',
  syncComposerScroll: true,
  predictionLayout: 'footer',
  predictionPopupTimeoutMs: 10000,
  typography: DEFAULT_TYPOGRAPHY,
};
const INITIAL_SESSION_ID = 'session-initial';
const INITIAL_SESSION_NAME = 'Current Session';
const createSessionId = () => `session-${Date.now()}`;
const createDefaultSessionName = () => {
  const now = new Date();
  return `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
};
const SESSION_LEXICAL_TOKEN_PATTERN = /[A-Za-z\\^'"_~.=\/]+/g;
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

const normalizeDisplaySettings = (
  displaySettings?: DisplaySettings,
  legacyTypography?: LegacyTypographySettings
): DisplaySettings => {
  if (displaySettings) {
    return {
      composerLayout: displaySettings.composerLayout ?? DEFAULT_DISPLAY_SETTINGS.composerLayout,
      syncComposerScroll: displaySettings.syncComposerScroll ?? DEFAULT_DISPLAY_SETTINGS.syncComposerScroll,
      predictionLayout: displaySettings.predictionLayout ?? DEFAULT_DISPLAY_SETTINGS.predictionLayout,
      predictionPopupTimeoutMs:
        displaySettings.predictionPopupTimeoutMs ?? DEFAULT_DISPLAY_SETTINGS.predictionPopupTimeoutMs,
      typography: {
        composer: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.composer,
          ...displaySettings.typography?.composer,
        },
        document: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.document,
          ...displaySettings.typography?.document,
        },
      },
    };
  }

  if (legacyTypography) {
    return {
      ...DEFAULT_DISPLAY_SETTINGS,
      typography: {
        composer: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.composer,
          ...legacyTypography,
        },
        document: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.document,
          ...legacyTypography,
        },
      },
    };
  }

  return {
    ...DEFAULT_DISPLAY_SETTINGS,
    typography: cloneTypographySettings(DEFAULT_DISPLAY_SETTINGS.typography),
  };
};

const shouldRecordCommittedBuffer = (activeBuffer: string, source: string, caret: number) => {
  if (!activeBuffer || caret <= 0) {
    return false;
  }

  const delimiter = source.slice(caret - 1, caret);
  return COMMIT_DELIMITER_PATTERN.test(delimiter);
};

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
  lastSavedAt: string | null;
  recentlyDeletedBlock: DeletedBlockSnapshot | null;

  // Actions
  setActiveBlockId: (id: string | null) => void;
  setNextChunk: () => void;
  setPrevChunk: () => void;
  setFocusSpan: (span: 'tight' | 'balanced' | 'wide') => void;
  setViewMode: (mode: 'focus' | 'read' | 'review') => void;
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
  deleteBlock: (blockId?: string) => void;
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
  setTypography: (
    scope: keyof TypographySettings,
    patch: Partial<TypographySettings[keyof TypographySettings]>
  ) => void;
  setSessionName: (name: string) => void;
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
      editorState: { ...state.editorState, viewMode: mode },
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
    const nextSelectionStart = selectionStart ?? get().composerSelectionStart;
    const nextSelectionEnd = selectionEnd ?? nextSelectionStart;

    const isNowLong = isLongBlockSource(newSource);
    
    // --- Dynamic Short to Long Block Conversion ---
    if (activeBlock.type === 'short' && isNowLong && !activeBlock.disableAutoSegmentation) {
      const newSegments = createSegments(newSource);
      const newlyConvertedBlock: CanonicalBlock = { // Explicitly type the new block
        ...activeBlock,
        type: 'long',
        source: newSource,
        rendered: transliterate(newSource).unicode,
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
            ? { ...block, source: newSource, rendered: transliterate(newSource).unicode }
            : block
        ),
        composerSelectionStart: nextSelectionStart,
        composerSelectionEnd: nextSelectionEnd,
      }));
    } else { // It's a long block (either was long, or just converted to long)
      if (!activeBlock.segments) return; // segments are guaranteed for long blocks

      const newBlocks = get().blocks.map((block) => {
        if (block.id === activeBlock!.id) { // activeBlock is guaranteed here
          const currentActiveBlock = activeBlock as CanonicalBlock & { segments: Segment[] };
          const beforeSegments = currentActiveBlock.segments.slice(0, activeChunkGroup.startSegmentIndex);
          const afterSegments = currentActiveBlock.segments.slice(activeChunkGroup.endSegmentIndex + 1);
          const mergedSegments: Segment[] = [
            ...beforeSegments,
            {
              id: `seg-${Date.now()}-active`,
              source: newSource,
              rendered: transliterate(newSource).unicode,
              startOffset: 0,
              endOffset: 0,
            },
            ...afterSegments,
          ];

          let offset = 0;
          const updatedSegments = mergedSegments.map((segment) => {
            const updatedSegment = {
              ...segment,
              startOffset: offset,
              endOffset: offset + segment.source.length,
            };
            offset = updatedSegment.endOffset;
            return updatedSegment;
          });

          const newFullSource = updatedSegments.map((segment) => segment.source).join('');
          const newFullRendered = transliterate(newFullSource).unicode;

          return { ...block, source: newFullSource, rendered: newFullRendered, segments: updatedSegments };
        }
        return block;
      });
      const newAnchorSegmentIndex = activeChunkGroup.startSegmentIndex;

      set((state) => ({
        blocks: newBlocks,
        editorState: {
          ...state.editorState,
          activeAnchorSegmentIndex: newAnchorSegmentIndex,
        },
        composerSelectionStart: nextSelectionStart,
        composerSelectionEnd: nextSelectionEnd,
      }));
    }

    // After updating the block (or after initial short block update), process suggestions for the new source
    const sourceBeforeCaret = newSource.slice(0, nextSelectionEnd);
    const wordsWithSpaces = sourceBeforeCaret.split(/(\s+)/);
    const lastWord = wordsWithSpaces[wordsWithSpaces.length - 1] || '';
    const activeBuffer = lastWord.match(/[a-zA-Z\^'_\.~=]+$/)?.[0] || '';

    let completionMatches: typeof MAPPING_TRIE = [];
    for (let len = Math.min(activeBuffer.length, 5); len > 0; len--) {
      const suffix = activeBuffer.slice(-len);
      const found = MAPPING_TRIE.filter(m => m.itrans.startsWith(suffix) && m.itrans !== suffix);
      if (found.length > 0) {
        completionMatches = found;
        break;
      }
    }
    const suggestions = (completionMatches.length > 0 ? completionMatches : MAPPING_TRIE.filter(m => m.itrans.startsWith(activeBuffer) && activeBuffer.length > 0))
      .slice(0, 5) // Limit to 5 suggestions
      .map(({ itrans, unicode }) => ({ itrans, unicode }));

    const alternateSuggestions: { itrans: string; unicode: string }[] = [];
    const seen = new Set<string>();
    const addSuggestion = (sug: { itrans: string; unicode: string } | undefined) => {
      if (sug && !seen.has(sug.itrans)) {
        alternateSuggestions.push(sug);
        seen.add(sug.itrans);
      }
    };
    
    const getMapping = (itrans: string) => MAPPING_TRIE.find(m => m.itrans === itrans);

    MAPPING_TRIE.filter(m => m.itrans === activeBuffer).forEach(addSuggestion);

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
    if (shouldRecordCommittedBuffer(previousActiveBuffer, newSource, nextSelectionEnd)) {
      get().recordSessionLexicalUse(previousActiveBuffer);
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
  },
  markSessionSaved: (savedAt) => {
    set({ lastSavedAt: savedAt ?? new Date().toISOString() });
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
      editorState: snapshot.editorState,
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
      rendered: transliterate(source).unicode,
      blockId: activeBlock.id,
    };
  },
}));
