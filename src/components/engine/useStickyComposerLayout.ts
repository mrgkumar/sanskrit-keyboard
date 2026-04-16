// app/src/components/engine/useStickyComposerLayout.ts
import * as React from 'react';
import { TypographySettings } from '@/store/types';

interface UseStickyComposerLayoutArgs {
  composerSplitContainerRef: React.RefObject<HTMLDivElement | null>;
  composerTypography: TypographySettings['composer'];
  isComposerCompareMode: boolean;
  isStackedComposer: boolean;
  setTypography: (
    scope: keyof TypographySettings,
    patch: Partial<TypographySettings[keyof TypographySettings]>
  ) => void;
}

export const useStickyComposerLayout = ({
  composerSplitContainerRef,
  composerTypography,
  isComposerCompareMode,
  isStackedComposer,
  setTypography,
}: UseStickyComposerLayoutArgs) => {
  const [composerSplitContainerWidth, setComposerSplitContainerWidth] = React.useState(0);

  const composerSplitDividerWidth = 20;
  const composerSplitMinPaneWidth = 320;
  const previewResizeHandleHeight = 16;
  const previewMinHeight = 112;
  const composerPrimaryPreviewHeight = composerTypography.primaryPreviewHeight;
  const composerComparePreviewHeight = isComposerCompareMode ? composerTypography.comparePreviewHeight : 0;
  const composerSplitRatio = composerTypography.sideBySideSplitRatio;
  const composerSplitAvailableWidth = Math.max(composerSplitContainerWidth - composerSplitDividerWidth, 0);
  const composerSourcePaneWidth =
    composerSplitAvailableWidth > 0 ? Math.round(composerSplitAvailableWidth * composerSplitRatio) : 0;
  const composerSplitMaxSourceWidth = Math.max(
    composerSplitAvailableWidth - composerSplitMinPaneWidth,
    composerSplitMinPaneWidth
  );
  const composerPreviewStackHeight = isComposerCompareMode
    ? composerPrimaryPreviewHeight + composerComparePreviewHeight + previewResizeHandleHeight
    : composerPrimaryPreviewHeight;
  const composerInputHeight = composerTypography.itransPanelHeight;
  const previewSplitMaxHeight = Math.max(
    composerPrimaryPreviewHeight + composerComparePreviewHeight - previewMinHeight,
    previewMinHeight
  );

  const updateComposerPreviewSplitHeight = React.useCallback(
    (nextPrimaryHeight: number) => {
      if (!isComposerCompareMode) {
        setTypography('composer', {
          primaryPreviewHeight: nextPrimaryHeight,
        } as Partial<TypographySettings['composer']>);
        return;
      }

      const currentContentHeight = composerPrimaryPreviewHeight + composerComparePreviewHeight;
      const boundedPrimary = Math.max(
        previewMinHeight,
        Math.min(nextPrimaryHeight, Math.max(currentContentHeight - previewMinHeight, previewMinHeight))
      );
      const boundedCompare = Math.max(previewMinHeight, currentContentHeight - boundedPrimary);

      setTypography('composer', {
        primaryPreviewHeight: boundedPrimary,
        comparePreviewHeight: boundedCompare,
      } as Partial<TypographySettings['composer']>);
    },
    [
      composerComparePreviewHeight,
      composerPrimaryPreviewHeight,
      isComposerCompareMode,
      previewMinHeight,
      setTypography,
    ]
  );

  const updateComposerInputHeight = React.useCallback(
    (nextHeight: number) => {
      if (!isComposerCompareMode) {
        setTypography('composer', {
          itransPanelHeight: nextHeight,
          primaryPreviewHeight: nextHeight,
        } as Partial<TypographySettings['composer']>);
        return;
      }

      const nextContentHeight = Math.max(nextHeight - previewResizeHandleHeight, previewMinHeight * 2);
      const currentContentHeight = composerPrimaryPreviewHeight + composerComparePreviewHeight;
      const currentRatio = currentContentHeight > 0 ? composerPrimaryPreviewHeight / currentContentHeight : 0.5;
      const nextPrimaryHeight = Math.max(
        previewMinHeight,
        Math.min(Math.round(nextContentHeight * currentRatio), nextContentHeight - previewMinHeight)
      );
      const nextCompareHeight = Math.max(previewMinHeight, nextContentHeight - nextPrimaryHeight);
      setTypography('composer', {
        itransPanelHeight: nextHeight,
        primaryPreviewHeight: nextPrimaryHeight,
        comparePreviewHeight: nextCompareHeight,
      } as Partial<TypographySettings['composer']>);
    },
    [
      composerComparePreviewHeight,
      composerPrimaryPreviewHeight,
      isComposerCompareMode,
      previewMinHeight,
      previewResizeHandleHeight,
      setTypography,
    ]
  );

  const updateComposerSplitWidth = React.useCallback(
    (nextSourceWidth: number) => {
      if (composerSplitAvailableWidth <= 0) {
        return;
      }

      const boundedSourceWidth = Math.max(
        composerSplitMinPaneWidth,
        Math.min(nextSourceWidth, composerSplitMaxSourceWidth)
      );

      setTypography('composer', {
        sideBySideSplitRatio: boundedSourceWidth / composerSplitAvailableWidth,
      } as Partial<TypographySettings['composer']>);
    },
    [
      composerSplitAvailableWidth,
      composerSplitMaxSourceWidth,
      composerSplitMinPaneWidth,
      setTypography,
    ]
  );

  React.useEffect(() => {
    if (isStackedComposer) {
      return;
    }

    const element = composerSplitContainerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setComposerSplitContainerWidth(element.getBoundingClientRect().width);
    };

    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [composerSplitContainerRef, isStackedComposer]);

  return {
    composerComparePreviewHeight,
    composerInputHeight,
    composerPreviewStackHeight,
    composerPrimaryPreviewHeight,
    composerSourcePaneWidth,
    composerSplitRatio,
    composerSplitDividerWidth,
    composerSplitMaxSourceWidth,
    composerSplitMinPaneWidth,
    previewMinHeight,
    previewResizeHandleHeight,
    previewSplitMaxHeight,
    updateComposerInputHeight,
    updateComposerPreviewSplitHeight,
    updateComposerSplitWidth,
  };
};
