// app/src/components/engine/StickyTopComposerPredictionPopup.tsx
import * as React from 'react';
import { createPortal } from 'react-dom';
import { WordPredictionTray } from '@/components/engine/WordPredictionTray';

interface StickyTopComposerPredictionPopupProps {
  isPredictionListbox: boolean;
  isPredictionPopupVisible: boolean;
  predictionPopupPortalStyle: React.CSSProperties;
  onSuggestionAccepted: () => void;
}

export const StickyTopComposerPredictionPopup: React.FC<StickyTopComposerPredictionPopupProps> = ({
  isPredictionListbox,
  isPredictionPopupVisible,
  predictionPopupPortalStyle,
  onSuggestionAccepted,
}) => {
  if (!isPredictionListbox || !isPredictionPopupVisible || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className="pointer-events-none fixed z-[120]" style={predictionPopupPortalStyle}>
      <WordPredictionTray
        variant="listbox"
        className="pointer-events-auto max-h-[12rem] bg-white/98 backdrop-blur-sm"
        onSuggestionAccepted={onSuggestionAccepted}
      />
    </div>,
    document.body
  );
};
