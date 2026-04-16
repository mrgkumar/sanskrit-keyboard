import { createHash } from 'node:crypto';

export const codePoints = (text: string) => Array.from(text, (char) => char.codePointAt(0) ?? 0);

export const hexCodePoint = (codePoint: number) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

export const positiveModulo = (value: number, modulo: number) => ((value % modulo) + modulo) % modulo;

export const rotateArray = <T>(values: T[], offset: number) => {
  if (values.length === 0) {
    return values;
  }
  const normalized = positiveModulo(offset, values.length);
  if (normalized === 0) {
    return [...values];
  }
  return [...values.slice(normalized), ...values.slice(0, normalized)];
};

export const mulberry32 = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const hashText = (text: string) => createHash('sha256').update(text).digest('hex');

export const hashObject = (value: unknown) => hashText(JSON.stringify(value));

export const stableJoin = (values: string[]) => values.join('');

export const encodeCursor = (cursor: { partitionId: string; entryIndex: number; batchIndex: number }) =>
  `${cursor.partitionId}|${cursor.entryIndex}|${cursor.batchIndex}`;

export const decodeCursor = (cursor: string) => {
  const [partitionId, entryIndex, batchIndex] = cursor.split('|');
  return {
    partitionId,
    entryIndex: Number(entryIndex),
    batchIndex: Number(batchIndex),
  };
};

export const uniqueSorted = (values: string[]) => [...new Set(values)].sort();
