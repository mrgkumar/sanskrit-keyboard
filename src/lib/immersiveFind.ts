import { formatSourceForScript } from '@/lib/vedic/utils';
import type { OutputScript, RomanOutputStyle, TamilOutputStyle } from '@/lib/vedic/mapping';
import type { CanonicalBlock, SanskritFontPreset } from '@/store/types';

export interface ImmersiveFindFormattingSettings {
  primaryOutputScript: OutputScript;
  romanOutputStyle: RomanOutputStyle;
  tamilOutputStyle: TamilOutputStyle;
  sanskritFontPreset: SanskritFontPreset;
}

export interface ImmersiveFindWordSpan {
  blockId: string;
  wordKey: string;
  startOffset: number;
  endOffset: number;
  sourceText: string;
  renderedText: string;
}

export interface ImmersiveFindMatch {
  blockId: string;
  startWordIndex: number;
  endWordIndex: number;
  startOffset: number;
  endOffset: number;
  wordKeys: string[];
  firstWordKey: string;
}

export const normalizeImmersiveFindText = (text: string) =>
  text
    .normalize('NFC')
    .replaceAll('\uF176', '\u1CDA')
    .replace(/\s+/g, ' ')
    .trim();

export const buildImmersiveFindPreviewText = (
  query: string,
  settings: ImmersiveFindFormattingSettings
) => {
  if (!query.trim()) {
    return '';
  }

  return formatSourceForScript(
    query,
    settings.primaryOutputScript,
    {
      romanOutputStyle: settings.romanOutputStyle,
      tamilOutputStyle: settings.tamilOutputStyle,
    },
    {
      sanskritFontPreset: settings.sanskritFontPreset,
    }
  );
};

export const buildImmersiveFindWordSpans = (
  blocks: CanonicalBlock[],
  settings: ImmersiveFindFormattingSettings
) =>
  blocks.map((block) => {
    const words: ImmersiveFindWordSpan[] = [];
    for (const match of block.source.matchAll(/\S+/g)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const sourceText = block.source.slice(start, end);
      words.push({
        blockId: block.id,
        wordKey: `${block.id}:${start}:${end}`,
        startOffset: start,
        endOffset: end,
        sourceText,
        renderedText: formatSourceForScript(
          sourceText,
          settings.primaryOutputScript,
          {
            romanOutputStyle: settings.romanOutputStyle,
            tamilOutputStyle: settings.tamilOutputStyle,
          },
          {
            sanskritFontPreset: settings.sanskritFontPreset,
          }
        ),
      });
    }

    return {
      blockId: block.id,
      words,
    };
  });

export const buildImmersiveFindMatches = (
  blockWordSpans: ReturnType<typeof buildImmersiveFindWordSpans>,
  queryPreviewText: string
) => {
  const queryTokens = normalizeImmersiveFindText(queryPreviewText)
    .split(' ')
    .filter(Boolean);

  if (queryTokens.length === 0) {
    return [] as ImmersiveFindMatch[];
  }

  const matches: ImmersiveFindMatch[] = [];
  for (const block of blockWordSpans) {
    const words = block.words;
    if (words.length === 0) {
      continue;
    }

    for (let startWordIndex = 0; startWordIndex < words.length; startWordIndex += 1) {
      let matched = true;
      for (let tokenIndex = 0; tokenIndex < queryTokens.length; tokenIndex += 1) {
        const word = words[startWordIndex + tokenIndex];
        if (!word) {
          matched = false;
          break;
        }

        const wordText = normalizeImmersiveFindText(word.renderedText);
        if (!wordText.includes(queryTokens[tokenIndex])) {
          matched = false;
          break;
        }
      }

      if (!matched) {
        continue;
      }

      const matchedWords = words.slice(startWordIndex, startWordIndex + queryTokens.length);
      const firstWord = matchedWords[0] ?? words[startWordIndex];
      const lastWord = matchedWords[matchedWords.length - 1] ?? firstWord;
      matches.push({
        blockId: block.blockId,
        startWordIndex,
        endWordIndex: startWordIndex + matchedWords.length - 1,
        startOffset: firstWord.startOffset,
        endOffset: lastWord.endOffset,
        wordKeys: matchedWords.map((word) => word.wordKey),
        firstWordKey: firstWord.wordKey,
      });
    }
  }

  return matches;
};

export const selectNonOverlappingImmersiveFindMatches = (matches: ImmersiveFindMatch[]) => {
  const selected: ImmersiveFindMatch[] = [];
  const lastSelectedEndByBlock = new Map<string, number>();

  for (const match of matches) {
    const lastSelectedEnd = lastSelectedEndByBlock.get(match.blockId);
    if (lastSelectedEnd !== undefined && match.startWordIndex <= lastSelectedEnd) {
      continue;
    }

    selected.push(match);
    lastSelectedEndByBlock.set(match.blockId, match.endWordIndex);
  }

  return selected;
};
