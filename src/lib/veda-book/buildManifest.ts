import { fetchRepoTree, type GitHubTreeEntry } from './fetchSource';
import { VEDA_BOOK_BRANCH, VEDA_BOOK_REPO } from './constants';
import type { VedaManifest, VedaManifestEntry } from './types';
import { formatTitleFromPath, normalizeReaderSearchText } from './renderText';
import { getCachedManifest, setCachedManifest } from './cache';

export interface ManifestTreeFolderNode {
  name: string;
  path: string;
  order: number;
  entries: VedaManifestEntry[];
  folders: ManifestTreeFolderNode[];
}

const createFolderNode = (name: string, path: string, order: number): ManifestTreeFolderNode => ({
  name,
  path,
  order,
  entries: [],
  folders: [],
});

const insertEntryIntoTree = (folder: ManifestTreeFolderNode, entry: VedaManifestEntry) => {
  const folderSegments = entry.folderPath.split('/').filter(Boolean);
  let currentFolder = folder;
  let currentPath = '';

  for (const segment of folderSegments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    let nextFolder = currentFolder.folders.find((child) => child.name === segment);
    if (!nextFolder) {
      nextFolder = createFolderNode(segment, currentPath, entry.order);
      currentFolder.folders.push(nextFolder);
    } else {
      nextFolder.order = Math.min(nextFolder.order, entry.order);
    }

    currentFolder = nextFolder;
  }

  currentFolder.entries.push(entry);
};

const sortManifestTreeNode = (node: ManifestTreeFolderNode) => {
  node.entries.sort((left, right) => left.order - right.order);
  node.folders.sort((left, right) => left.order - right.order || left.name.localeCompare(right.name));
  node.folders.forEach(sortManifestTreeNode);
};

const buildEntry = (path: string, order: number): VedaManifestEntry => {
  const cleanedPath = path.replace(/^\.?\//, '');
  const parts = cleanedPath.split('/');
  const fileName = parts[parts.length - 1] ?? cleanedPath;
  const folderPath = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const category = parts.length > 1 ? parts[0] : 'mantras';

  return {
    id: cleanedPath,
    path: cleanedPath,
    title: formatTitleFromPath(fileName),
    category,
    folderPath,
    order,
    sourceRepo: VEDA_BOOK_REPO,
    branch: VEDA_BOOK_BRANCH,
  };
};

export const buildManifestFromMantrasTex = async (options?: { force?: boolean }) => {
  const cachedManifest = options?.force ? null : await getCachedManifest();
  if (cachedManifest) {
    return cachedManifest;
  }

  const repoTree = await fetchRepoTree(options);
  const paths = repoTree.tree
    .filter((entry: GitHubTreeEntry): entry is GitHubTreeEntry & { type: 'blob' } => entry.type === 'blob' && entry.path.endsWith('.tex'))
    .map((entry) => entry.path)
    .sort((left, right) => {
      if (left === 'mantras.tex') return -1;
      if (right === 'mantras.tex') return 1;
      return left.localeCompare(right);
    });
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

export const buildManifestTree = (entries: VedaManifestEntry[]) => {
  const root = createFolderNode('Root', '', Number.NEGATIVE_INFINITY);
  for (const entry of [...entries].sort((left, right) => left.order - right.order)) {
    if (!entry.folderPath) {
      root.entries.push(entry);
      continue;
    }

    insertEntryIntoTree(root, entry);
  }

  sortManifestTreeNode(root);
  return root;
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

export interface GroupedManifestEntries {
  folderPath: string;
  entries: VedaManifestEntry[];
}

export const groupManifestEntriesByFolder = (entries: VedaManifestEntry[]): GroupedManifestEntries[] => {
  const groups = new Map<string, VedaManifestEntry[]>();
  for (const entry of entries) {
    const folderPath = entry.folderPath || '';
    const bucket = groups.get(folderPath) ?? [];
    bucket.push(entry);
    groups.set(folderPath, bucket);
  }

  return [...groups.entries()]
    .map(([folderPath, groupedEntries]) => ({
      folderPath,
      entries: groupedEntries.sort((left, right) => left.order - right.order),
    }))
    .sort((left, right) => left.folderPath.localeCompare(right.folderPath));
};
