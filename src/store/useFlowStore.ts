// app/src/store/useFlowStore.ts
import { create } from 'zustand';
import {
  CanonicalBlock,
  Segment,
  ChunkGroup,
  EditorState,
} from './types';
import { transliterate } from '@/lib/vedic/utils';
import { MAPPING_TRIE } from '@/lib/vedic/mapping';

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


// --- MOCK DATA ---

const MOCK_SHORT_BLOCK: CanonicalBlock = {
  id: 'block-1',
  type: 'short',
  title: 'Gaṇeśa Mantra',
  source: 'oM gaM gaNapataye namaH',
  rendered: transliterate('oM gaM gaNapataye namaH').unicode,
};

const LONG_SOURCE = "oM saha nAvavatu | saha nau bhunaktu | saha vIryaM karavAvahai | tejasvi nAvadhItamastu mA vidviShAvahai || oM shAntiH shAntiH shAntiH ||";
const MOCK_LONG_BLOCK: CanonicalBlock = {
  id: 'block-2',
  type: 'long',
  title: 'Śānti Mantra',
  source: LONG_SOURCE,
  rendered: transliterate(LONG_SOURCE).unicode,
  segments: createSegments(LONG_SOURCE), // Segmenting the long source
};

const INITIAL_BLOCKS = [MOCK_SHORT_BLOCK, MOCK_LONG_BLOCK];


// --- STORE DEFINITION ---

export interface SanskritKeyboardState {
  // Core Data
  blocks: CanonicalBlock[];
  editorState: EditorState;

  // Suggestion/Contextual Assist State
  activeBuffer: string;
  suggestions: { itrans: string; unicode: string }[];
  alternateSuggestions: { itrans: string; unicode: string }[];
  selectedSuggestionIndex: number;
  ghostText: string | null;

  // UI State
  isReferencePanelOpen: boolean;
  deletedBuffer: string | null;

  // Actions
  setActiveBlockId: (id: string | null) => void;
  setNextChunk: () => void;
  setPrevChunk: () => void;
  setFocusSpan: (span: 'tight' | 'balanced' | 'wide') => void;
  setViewMode: (mode: 'focus' | 'read' | 'review') => void;
  updateChunkSource: (newSource: string) => void;
  toggleReferencePanel: () => void;
  addBlocks: (itransStrings: string[]) => void;
  setDeletedBuffer: (char: string | null) => void;

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
    viewMode: 'focus',
    ghostAssistEnabled: true,
  },
  activeBuffer: '',
  suggestions: [],
  alternateSuggestions: [],
  selectedSuggestionIndex: 0,
  ghostText: null,
  isReferencePanelOpen: false, // Initialize here
  deletedBuffer: null, // Initialize here

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
  updateChunkSource: (newSource) => {
    const { getActiveBlock, getActiveChunkGroup } = get();
    let activeBlock = getActiveBlock(); // Use 'let' because we might reassign it

    if (!activeBlock) return;

    // Heuristic for determining if a block should be 'long'
    const isNowLong = newSource.length > 100 || newSource.split(/[\s|]+/).length > 10;
    
    // --- Dynamic Short to Long Block Conversion ---
    if (activeBlock.type === 'short' && isNowLong) {
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
      }));
    } else { // It's a long block (either was long, or just converted to long)
      const activeChunk = getActiveChunkGroup();
      if (!activeChunk || !activeBlock.segments) return; // segments are guaranteed for long blocks

      const newBlocks = get().blocks.map((block) => {
        if (block.id === activeBlock!.id) { // activeBlock is guaranteed here
          const currentActiveBlock = activeBlock as CanonicalBlock & { segments: Segment[] };

          const updatedSegments = currentActiveBlock.segments.map((segment, index) => {
            if (index >= activeChunk.startSegmentIndex && index <= activeChunk.endSegmentIndex) {
              const relativeStartOffset = segment.startOffset - currentActiveBlock.segments[activeChunk.startSegmentIndex].startOffset;
              const relativeEndOffset = segment.endOffset - currentActiveBlock.segments[activeChunk.startSegmentIndex].startOffset;
              const newSegmentSource = newSource.substring(relativeStartOffset, relativeEndOffset);
              return { ...segment, source: newSegmentSource, rendered: transliterate(newSegmentSource).unicode };
            }
            return segment;
          });

          const newFullSource = updatedSegments.map((s) => s.source).join('');
          const newFullRendered = transliterate(newFullSource).unicode;

          return { ...block, source: newFullSource, rendered: newFullRendered, segments: updatedSegments };
        }
        return block;
      });
      set({ blocks: newBlocks });
    }

    // After updating the block (or after initial short block update), process suggestions for the new source
    const wordsWithSpaces = newSource.split(/(\s+)/);
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
      ["^", "\\^", "''", '"']
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
      selectedSuggestionIndex: 0 // Reset selected suggestion index
    });
  },
  addBlocks: (itransStrings: string[]) => {
    const newBlocks: CanonicalBlock[] = itransStrings
      .filter(str => str.trim().length > 0) // Filter out empty strings
      .map((itransSource, index) => {
        const id = `block-${Date.now()}-${index}`; // Unique ID
        const rendered = transliterate(itransSource).unicode;
        const type = itransSource.length > 100 || itransSource.split(/[\s|]+/).length > 10 ? 'long' : 'short'; // Heuristic for long/short
        
        const block: CanonicalBlock = {
          id,
          type,
          title: `Pasted Block ${get().blocks.length + index + 1}`,
          source: itransSource,
          rendered: rendered,
        };

        if (type === 'long') {
          block.segments = createSegments(itransSource);
        }
        return block;
      });

    if (newBlocks.length > 0) {
      set((state) => ({
        blocks: [...state.blocks, ...newBlocks],
        editorState: {
          ...state.editorState,
          activeBlockId: newBlocks[0].id, // Set first new block as active
          activeAnchorSegmentIndex: 0,
        },
      }));
    }
  },
  setDeletedBuffer: (char: string | null) => {
    set({ deletedBuffer: char });
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
        rendered: activeBlock.rendered
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
    };
  },
}));
