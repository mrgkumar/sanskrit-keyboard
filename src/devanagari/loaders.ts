import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { PathLike } from 'node:fs';

export const ensureDir = (path: string) => {
  mkdirSync(path, { recursive: true });
};

export const readText = (path: PathLike) => readFileSync(path, 'utf8');

export const readJson = <T>(path: PathLike): T => JSON.parse(readText(path)) as T;

export const writeJson = (path: PathLike, value: unknown) => {
  writeFileSync(path, JSON.stringify(value, null, 2));
};

export const writeJsonLine = (path: PathLike, value: unknown) => {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
};
