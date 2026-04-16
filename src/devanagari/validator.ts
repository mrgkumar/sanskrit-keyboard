import type { CuratedInventories } from './curatedInventories.ts';
import type { BatchRequest, CorpusEntry } from './types.ts';
import { codePoints } from './utils.ts';

const isConsonant = (char: string, inventories: CuratedInventories) => inventories.consonants.includes(char);
const isVowel = (char: string, inventories: CuratedInventories) => inventories.vowels.includes(char);
const isVowelSign = (char: string, inventories: CuratedInventories) =>
  inventories.dependentVowelSigns.includes(char);
const isBindu = (char: string, inventories: CuratedInventories) => inventories.binduSigns.includes(char);
const isVedic = (char: string, inventories: CuratedInventories) => inventories.vedicSigns.includes(char);
const isGeneralCombining = (char: string, inventories: CuratedInventories) =>
  inventories.combiningMarks.includes(char);

export interface ValidationOptions {
  request: BatchRequest;
  inventories: CuratedInventories;
}

export const validateCodePointLength = (text: string, expectedLength: number) =>
  codePoints(text).length === expectedLength;

export const validateOrthography = (text: string, options: ValidationOptions) => {
  const { request, inventories } = options;
  const chars = Array.from(text);
  if (chars.length === 0) {
    return { valid: false, reason: 'empty-text' };
  }

  if (chars.length !== request.length) {
    return { valid: false, reason: 'length-mismatch' };
  }

  const first = chars[0];
  if (!isConsonant(first, inventories) && !isVowel(first, inventories)) {
    return { valid: false, reason: 'invalid-leading-code-point' };
  }

  for (let index = 0; index < chars.length; index++) {
    const current = chars[index];
    const previous = chars[index - 1];
    const next = chars[index + 1];

    if (current === inventories.virama) {
      if (index === 0 || index === chars.length - 1) {
        return { valid: false, reason: 'virama-boundary' };
      }
      if (!isConsonant(previous, inventories) || !isConsonant(next, inventories)) {
        return { valid: false, reason: 'virama-host-or-follower-invalid' };
      }
    }

    if (current === inventories.nukta) {
      if (!isConsonant(previous, inventories)) {
        return { valid: false, reason: 'nukta-host-invalid' };
      }
    }

    if (isVowelSign(current, inventories)) {
      if (!isConsonant(previous, inventories)) {
        return { valid: false, reason: 'matra-host-invalid' };
      }
    }

    if (isVedic(current, inventories) || isGeneralCombining(current, inventories) || isBindu(current, inventories)) {
      if (index === 0) {
        return { valid: false, reason: 'mark-leading-invalid' };
      }
    }
  }

  if (!request.includeVedic && chars.some((char) => isVedic(char, inventories))) {
    return { valid: false, reason: 'vedic-disabled' };
  }

  return { valid: true as const };
};

export const validateEntry = (entry: CorpusEntry, options: ValidationOptions) =>
  validateOrthography(entry.text, options).valid && validateCodePointLength(entry.text, options.request.length);
