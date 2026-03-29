import { expect, test } from '@playwright/test';
import { applyShortcutPeekCorrection } from '@/lib/vedic/correction';

test.describe('applyShortcutPeekCorrection', () => {
  test('replaces overlap-heavy suffixes instead of appending them', () => {
    const cases = [
      { label: 'vocalic r short', currentSource: 'prr', deletedBuffer: 'i', replacement: 'RRi', expected: 'pRRi' },
      { label: 'vocalic r long', currentSource: 'prr', deletedBuffer: 'I', replacement: 'RRI', expected: 'pRRI' },
      { label: 'vocalic l short', currentSource: 'kll', deletedBuffer: 'i', replacement: 'LLi', expected: 'kLLi' },
      { label: 'vocalic l long', currentSource: 'kll', deletedBuffer: 'I', replacement: 'LLI', expected: 'kLLI' },
      { label: 'long a', currentSource: 'ga', deletedBuffer: 'a', replacement: 'aa', expected: 'gaa' },
      { label: 'diphthong ai', currentSource: 'a', deletedBuffer: 'i', replacement: 'ai', expected: 'ai' },
      { label: 'diphthong au', currentSource: 'a', deletedBuffer: 'u', replacement: 'au', expected: 'au' },
      { label: 'aspirated kh', currentSource: 'vak', deletedBuffer: 'h', replacement: 'kh', expected: 'vakh' },
      { label: 'aspirated gh', currentSource: 'lag', deletedBuffer: 'h', replacement: 'gh', expected: 'lagh' },
      { label: 'aspirated th', currentSource: 'tat', deletedBuffer: 'h', replacement: 'th', expected: 'tath' },
      { label: 'aspirated dh', currentSource: 'dad', deletedBuffer: 'h', replacement: 'dh', expected: 'dadh' },
      { label: 'aspirated ph', currentSource: 'kap', deletedBuffer: 'h', replacement: 'ph', expected: 'kaph' },
      { label: 'aspirated bh', currentSource: 'lab', deletedBuffer: 'h', replacement: 'bh', expected: 'labh' },
      { label: 'aspirated jh', currentSource: 'raj', deletedBuffer: 'h', replacement: 'jh', expected: 'rajh' },
      { label: 'palatal sh', currentSource: 'sas', deletedBuffer: 'h', replacement: 'sh', expected: 'sash' },
      { label: 'retroflex Sh', currentSource: 'paS', deletedBuffer: 'h', replacement: 'Sh', expected: 'paSh' },
    ];

    for (const testCase of cases) {
      const result = applyShortcutPeekCorrection({
        currentSource: testCase.currentSource,
        selectionStart: testCase.currentSource.length,
        selectionEnd: testCase.currentSource.length,
        replacement: testCase.replacement,
        deletedBuffer: testCase.deletedBuffer,
      });

      expect(result.nextSource, testCase.label).toBe(testCase.expected);
      expect(result.nextCaret, testCase.label).toBe(testCase.expected.length);
    }
  });

  test('falls back to replacing the visible shortcut query when there is no deleted overlap match', () => {
    const result = applyShortcutPeekCorrection({
      currentSource: 'pra',
      selectionStart: 3,
      selectionEnd: 3,
      replacement: 'ai',
      deletedBuffer: null,
      shortcutPeekQuery: 'a',
    });

    expect(result.nextSource).toBe('prai');
    expect(result.nextCaret).toBe(4);
  });

  test('replaces the selected range directly when text is selected', () => {
    const result = applyShortcutPeekCorrection({
      currentSource: 'pra',
      selectionStart: 1,
      selectionEnd: 3,
      replacement: 'RRi',
      deletedBuffer: 'i',
      shortcutPeekQuery: 'ra',
    });

    expect(result.nextSource).toBe('pRRi');
    expect(result.nextCaret).toBe(4);
  });
});
