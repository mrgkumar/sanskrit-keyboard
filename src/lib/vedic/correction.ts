export interface ApplyShortcutPeekCorrectionInput {
  currentSource: string;
  selectionStart: number;
  selectionEnd: number;
  replacement: string;
  deletedBuffer: string | null;
  shortcutPeekQuery?: string;
}

export interface ApplyShortcutPeekCorrectionResult {
  nextSource: string;
  nextCaret: number;
  replaceStart: number;
  replaceEnd: number;
}

export const applyShortcutPeekCorrection = ({
  currentSource,
  selectionStart,
  selectionEnd,
  replacement,
  deletedBuffer,
  shortcutPeekQuery,
}: ApplyShortcutPeekCorrectionInput): ApplyShortcutPeekCorrectionResult => {
  const start = Math.max(0, Math.min(selectionStart, currentSource.length));
  const end = Math.max(start, Math.min(selectionEnd, currentSource.length));
  let replaceStart = start;
  const replaceEnd = end;

  if (deletedBuffer && start === end) {
    const restoredCaret = start + deletedBuffer.length;
    const sourceBeforeDelete =
      currentSource.slice(0, start) +
      deletedBuffer +
      currentSource.slice(end);
    const normalizedTarget = replacement.toLowerCase();
    let matchedLength = 0;

    for (let length = Math.min(normalizedTarget.length, restoredCaret); length >= deletedBuffer.length; length--) {
      const restoredSuffix = sourceBeforeDelete.slice(restoredCaret - length, restoredCaret).toLowerCase();
      const targetSuffix = normalizedTarget.slice(normalizedTarget.length - length);
      if (restoredSuffix === targetSuffix) {
        matchedLength = length;
        break;
      }
    }

    if (matchedLength > 0) {
      const currentlyPresentLength = Math.max(0, matchedLength - deletedBuffer.length);
      replaceStart = Math.max(0, start - currentlyPresentLength);
    } else if (shortcutPeekQuery && currentSource.slice(0, start).endsWith(shortcutPeekQuery)) {
      replaceStart = Math.max(0, start - shortcutPeekQuery.length);
    }
  } else if (shortcutPeekQuery && currentSource.slice(0, start).endsWith(shortcutPeekQuery)) {
    replaceStart = Math.max(0, start - shortcutPeekQuery.length);
  }

  const nextSource =
    currentSource.slice(0, replaceStart) +
    replacement +
    currentSource.slice(replaceEnd);
  const nextCaret = replaceStart + replacement.length;

  return {
    nextSource,
    nextCaret,
    replaceStart,
    replaceEnd,
  };
};
