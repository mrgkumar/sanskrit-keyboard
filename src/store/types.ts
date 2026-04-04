// app/src/store/types.ts
import type {
  ComparisonOutputScript,
  InputScheme,
  OutputScheme,
  OutputScript,
  RomanOutputStyle,
  TamilOutputStyle,
} from '@/lib/vedic/mapping';

export type ViewMode = 'focus' | 'read' | 'review' | 'immersive' | 'document';

/**
 * A CanonicalBlock is the primary storage and reading unit of the document.
 * It represents a semantically whole piece of text, like a mantra, a sentence, or a paragraph.
 * Its content is preserved intact and is never destructively split for editing.
 */
export interface CanonicalBlock {
  id: string;
  type: 'short' | 'long';
  title?: string;
  disableAutoSegmentation?: boolean;
  // The full, canonical ITRANS source for the entire block
  source: string; 
  // The full, rendered Devanagari for the entire block
  rendered: string; 
  // For 'long' blocks, the source is broken down into smaller, manageable segments.
  segments?: Segment[];
}

/**
 * A Segment is an internal, non-semantic subdivision of a long CanonicalBlock's source.
 * It is used as a building block for creating ergonomic editing chunks.
 * Example: A long sentence might be broken into segments at commas or natural pauses.
 */
export interface Segment {
  id: string;
  // The ITRANS source for this segment only
  source: string; 
  // The rendered Devanagari for this segment only
  rendered: string; 
  // The starting character offset of this segment within the CanonicalBlock's full source
  startOffset: number;
  // The ending character offset of this segment within the CanonicalBlock's full source
  endOffset: number;
}

/**
 * A ChunkGroup is the actual unit of editing in the sticky composer.
 * It is a dynamically created group of one or more Segments, based on the current FocusSpan.
 * The user edits the source of a ChunkGroup, not the entire CanonicalBlock at once.
 */
export interface ChunkGroup {
  // Index of the first segment in this group within the block's segments array
  startSegmentIndex: number; 
  // Index of the last segment in this group within the block's segments array
  endSegmentIndex: number; 
  // The combined ITRANS source of all segments in this group
  source: string; 
  // The combined rendered Devanagari of all segments in this group
  rendered: string;
  blockId?: string;
}

export interface ChunkEditTarget {
  blockId: string;
  startSegmentIndex: number;
  endSegmentIndex: number;
  source: string;
}

/**
 * Defines the overall state of the editor, including user settings and active selections.
 */
export interface EditorState {
  activeBlockId: string | null;
  activeAnchorSegmentIndex?: number;
  focusSpan: 'tight' | 'balanced' | 'wide';
  viewMode: ViewMode;
  ghostAssistEnabled: boolean;
}

export interface TypographySettings {
  composer: {
    itransFontSize: number;
    devanagariFontSize: number;
    tamilFontSize: number;
    itransLineHeight: number;
    devanagariLineHeight: number;
    tamilLineHeight: number;
    itransPanelHeight: number;
    renderedFontSize: number;
    renderedLineHeight: number;
    primaryPreviewHeight: number;
    comparePreviewHeight: number;
  };
  document: {
    itransFontSize: number;
    devanagariFontSize: number;
    tamilFontSize: number;
    itransLineHeight: number;
    devanagariLineHeight: number;
    tamilLineHeight: number;
    primaryPaneHeight: number;
    comparePaneHeight: number;
    renderedFontSize: number;
    renderedLineHeight: number;
  };
}

export type SanskritFontPreset = 'chandas' | 'siddhanta' | 'sampradaya';
export type TamilFontPreset = 'hybrid' | 'noto-serif' | 'anek';

export interface LegacyTypographySettings {
  itransFontSize: number;
  itransLineHeight: number;
  renderedFontSize: number;
  renderedLineHeight: number;
}

export interface DisplaySettings {
  composerLayout: 'side-by-side' | 'stacked';
  syncComposerScroll: boolean;
  predictionLayout: 'footer' | 'inline' | 'split' | 'listbox';
  predictionPopupTimeoutMs: number;
  inputScheme: InputScheme;
  outputScheme: OutputScheme;
  primaryOutputScript: OutputScript;
  comparisonOutputScript: ComparisonOutputScript;
  romanOutputStyle: RomanOutputStyle;
  tamilOutputStyle: TamilOutputStyle;
  sanskritFontPreset: SanskritFontPreset;
  tamilFontPreset: TamilFontPreset;
  autoSwapVisargaSvarita: boolean;
  showItransInDocument: boolean;
  typography: TypographySettings;
}

export interface SessionSnapshot {
  sessionId: string;
  sessionName: string;
  blocks: CanonicalBlock[];
  editorState: EditorState;
  displaySettings?: DisplaySettings;
  typography?: LegacyTypographySettings;
  updatedAt: string;
}
