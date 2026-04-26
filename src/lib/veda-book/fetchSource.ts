import { VEDA_BOOK_GITHUB_API_BASE, VEDA_BOOK_RAW_BASE } from './constants';

const buildCacheBustingUrl = (url: string, force?: boolean) => {
  if (!force) {
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}reader_cache=${Date.now()}`;
};

const normalizeRelativePath = (path: string) => path.replace(/^\/+/, '');

export const buildRawSourceUrl = (path: string, options?: { force?: boolean }) =>
  buildCacheBustingUrl(`${VEDA_BOOK_RAW_BASE}/${normalizeRelativePath(path)}`, options?.force);

export const buildMantrasIndexUrl = (options?: { force?: boolean }) =>
  buildCacheBustingUrl(`${VEDA_BOOK_RAW_BASE}/mantras.tex`, options?.force);

const readTextResponse = async (response: Response, context: string) => {
  if (!response.ok) {
    throw new Error(`${context} failed with HTTP ${response.status}`);
  }

  return response.text();
};

export const fetchRawTex = async (path: string, options?: { force?: boolean }) => {
  const response = await fetch(buildRawSourceUrl(path, options), {
    cache: options?.force ? 'reload' : 'no-store',
  });
  return readTextResponse(response, `Fetching ${path}`);
};

export const fetchMantrasIndex = async (options?: { force?: boolean }) => {
  const response = await fetch(buildMantrasIndexUrl(options), {
    cache: options?.force ? 'reload' : 'no-store',
  });
  return readTextResponse(response, 'Fetching mantras.tex');
};

export interface GitHubTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTreeResponse {
  sha: string;
  url: string;
  truncated: boolean;
  tree: GitHubTreeEntry[];
}

export const fetchRepoTree = async (options?: { force?: boolean }) => {
  const response = await fetch(
    buildCacheBustingUrl(`${VEDA_BOOK_GITHUB_API_BASE}/git/trees/master?recursive=1`, options?.force),
    {
      cache: options?.force ? 'reload' : 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Fetching repository tree failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<GitHubTreeResponse>;
};
