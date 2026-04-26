import { fetchMantrasIndex } from './fetchSource';
import { VEDA_BOOK_BRANCH, VEDA_BOOK_REPO } from './constants';
import type { VedaManifest, VedaManifestEntry } from './types';
import { formatTitleFromPath, normalizeReaderSearchText } from './renderText';
import { getCachedManifest, setCachedManifest } from './cache';

const INPUT_PATTERN = /\\input\s*\{\s*"?([^"}]+)"?\s*\}/g;

const buildEntry = (path: string, order: number): VedaManifestEntry => {
  const cleanedPath = path.replace(/^\.?\//, '');
  const parts = cleanedPath.split('/');
  const fileName = parts[parts.length - 1] ?? cleanedPath;
  const category = parts.length > 1 ? parts[0] : 'mantras';

  return {
    id: cleanedPath,
    path: cleanedPath,
    title: formatTitleFromPath(fileName),
    category,
    order,
    sourceRepo: VEDA_BOOK_REPO,
    branch: VEDA_BOOK_BRANCH,
  };
};

const extractInputs = (mantrasTex: string) => {
  const stripped = mantrasTex
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => {
      let result = '';
      let escaped = false;
      for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '%' && !escaped) {
          break;
        }
        result += char;
        escaped = char === '\\' && !escaped;
      }
      return result;
    })
    .join('\n');

  return [...stripped.matchAll(INPUT_PATTERN)].map((match) => match[1].trim());
};

export const buildManifestFromMantrasTex = async (options?: { force?: boolean }) => {
  const cachedManifest = options?.force ? null : await getCachedManifest();
  if (cachedManifest) {
    return cachedManifest;
  }

  const indexTex = await fetchMantrasIndex(options);
  const paths = extractInputs(indexTex);
  const entries = paths.map((path, index) => buildEntry(path, index));

  const manifest: VedaManifest = {
    sourceRepo: VEDA_BOOK_REPO,
    branch: VEDA_BOOK_BRANCH,
    builtAt: new Date().toISOString(),
    entries,
  };

  await setCachedManifest(manifest);
  return manifest;
};

export const filterManifestEntries = (entries: VedaManifestEntry[], query: string) => {
  const normalizedQuery = normalizeReaderSearchText(query);
  if (!normalizedQuery) {
    return entries;
  }

  return entries.filter((entry) => {
    const title = normalizeReaderSearchText(entry.title);
    const path = normalizeReaderSearchText(entry.path);
    return title.includes(normalizedQuery) || path.includes(normalizedQuery);
  });
};
