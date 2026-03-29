import fs from 'node:fs';
import path from 'node:path';

export interface CorpusSample {
  token: string;
  difficulty: 'simple' | 'hard';
  index: number;
}

const TOKEN_REGEX =
  /[\p{Script_Extensions=Devanagari}\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]+/gu;

const SIMPLE_MARKS_REGEX =
  /[\u0951\u0952\u0956\u0964\u0965\u1CD0-\u1CFF\uA8E0-\uA8FF\uF000-\uF8FF]/u;

const tokenizeCorpus = (text: string): string[] =>
  [...text.matchAll(TOKEN_REGEX)]
    .map((match) => match[0].trim())
    .filter(Boolean);

const isSimpleToken = (token: string): boolean => {
  if (token.length < 2 || token.length > 14) {
    return false;
  }

  if (SIMPLE_MARKS_REGEX.test(token)) {
    return false;
  }

  return /[\u0904-\u0939\u0958-\u097F]/u.test(token);
};

const evenlySample = (tokens: string[], targetCount: number): string[] => {
  if (tokens.length <= targetCount) {
    return tokens;
  }

  const sample: string[] = [];
  const usedIndexes = new Set<number>();
  const step = tokens.length / targetCount;

  for (let i = 0; i < targetCount; i += 1) {
    let index = Math.min(tokens.length - 1, Math.floor((i + 0.5) * step));

    while (usedIndexes.has(index) && index < tokens.length - 1) {
      index += 1;
    }

    while (usedIndexes.has(index) && index > 0) {
      index -= 1;
    }

    usedIndexes.add(index);
    sample.push(tokens[index]);
  }

  return sample;
};

export const loadCorpusSamples = (): CorpusSample[] => {
  const corpusPath = path.resolve(__dirname, '../../archive/example.txt');
  const text = fs.readFileSync(corpusPath, 'utf8');
  const tokens = tokenizeCorpus(text);

  const simplePool = tokens.filter(isSimpleToken);
  const hardPool = tokens.filter((token) => !isSimpleToken(token));

  const simple = evenlySample(simplePool, 1000).map((token, index) => ({
    token,
    difficulty: 'simple' as const,
    index,
  }));

  const hard = evenlySample(hardPool, 1000).map((token, index) => ({
    token,
    difficulty: 'hard' as const,
    index,
  }));

  return [...simple, ...hard];
};
