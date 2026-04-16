// app/src/store/flowStoreDisplay.ts
import {
  canonicalizeAcceptedInputToken,
  DEFAULT_OUTPUT_TARGET_SETTINGS,
  normalizeOutputTargetSettings,
  resolveLegacyOutputSchemeBridge,
  type InputScheme,
} from '@/lib/vedic/mapping';
import {
  DisplaySettings,
  LegacyTypographySettings,
  TypographySettings,
  ViewMode,
} from './types';

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
    itransPanelHeight: 150,
    primaryPreviewHeight: 150,
    comparePreviewHeight: 150,
    sideBySideSplitRatio: 0.54,
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
  immersive: {
    devanagariFontSize: 32,
    devanagariLineHeight: 1.9,
    tamilFontSize: 28,
    tamilLineHeight: 2,
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

export const cloneTypographySettings = (settings: TypographySettings): TypographySettings => ({
  composer: { ...settings.composer },
  document: { ...settings.document },
  immersive: { ...settings.immersive },
});

export const clampTypographyHeights = (settings: TypographySettings): TypographySettings => ({
  composer: {
    ...settings.composer,
    itransPanelHeight: Math.max(settings.composer.itransPanelHeight, 140),
    primaryPreviewHeight: Math.max(settings.composer.primaryPreviewHeight, 140),
    comparePreviewHeight: Math.max(settings.composer.comparePreviewHeight, 140),
    sideBySideSplitRatio: Math.max(0.32, Math.min(settings.composer.sideBySideSplitRatio, 0.68)),
  },
  document: {
    ...settings.document,
    primaryPaneHeight: Math.max(settings.document.primaryPaneHeight, 260),
    comparePaneHeight: Math.max(settings.document.comparePaneHeight, 260),
  },
  immersive: {
    ...settings.immersive,
    devanagariFontSize: Math.max(settings.immersive.devanagariFontSize, 18),
    tamilFontSize: Math.max(settings.immersive.tamilFontSize, 18),
    devanagariLineHeight: Math.max(settings.immersive.devanagariLineHeight, 1.2),
    tamilLineHeight: Math.max(settings.immersive.tamilLineHeight, 1.2),
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
          sideBySideSplitRatio:
            displaySettings.typography?.composer?.sideBySideSplitRatio ??
            DEFAULT_DISPLAY_SETTINGS.typography.composer.sideBySideSplitRatio,
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
        immersive: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.immersive,
          ...displaySettings.typography?.immersive,
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
        immersive: {
          ...DEFAULT_DISPLAY_SETTINGS.typography.immersive,
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

  const nextSource = source.slice(0, tokenStart) + canonicalBuffer + source.slice(delimiterIndex);
  const delta = canonicalBuffer.length - committedBuffer.length;

  return {
    source: nextSource,
    caret: caret + delta,
    canonicalBuffer,
  };
};

export const normalizeViewMode = (mode: ViewMode): ViewMode =>
  mode === 'review' ? 'read' : mode;
