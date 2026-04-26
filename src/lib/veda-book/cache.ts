import Dexie, { type Table } from 'dexie';
import type { MantraDocument, VedaManifest } from './types';
import {
  READER_MANIFEST_CACHE_KEY,
  READER_PARSED_DOCUMENT_CACHE_PREFIX,
  READER_RAW_DOCUMENT_CACHE_PREFIX,
} from './constants';

interface ManifestRecord {
  key: string;
  manifest: VedaManifest;
}

interface RawDocumentRecord {
  key: string;
  path: string;
  rawTex: string;
  fetchedAt: string;
  sourceRepo: string;
  branch: string;
  sourceSha?: string;
}

interface ParsedDocumentRecord {
  key: string;
  path: string;
  document: MantraDocument;
}

class VedaReaderDexie extends Dexie {
  manifests!: Table<ManifestRecord, string>;

  rawDocuments!: Table<RawDocumentRecord, string>;

  parsedDocuments!: Table<ParsedDocumentRecord, string>;

  constructor() {
    super('veda-reader-cache');
    this.version(1).stores({
      manifests: 'key',
      rawDocuments: 'key',
      parsedDocuments: 'key',
    });
  }
}

let dbInstance: VedaReaderDexie | null = null;

const getDb = () => {
  if (typeof indexedDB === 'undefined') {
    return null;
  }

  if (!dbInstance) {
    dbInstance = new VedaReaderDexie();
  }

  return dbInstance;
};

export const getCachedManifest = async () => {
  const db = getDb();
  if (!db) {
    return null;
  }

  const record = await db.manifests.get(READER_MANIFEST_CACHE_KEY);
  return record?.manifest ?? null;
};

export const setCachedManifest = async (manifest: VedaManifest) => {
  const db = getDb();
  if (!db) {
    return;
  }

  await db.manifests.put({ key: READER_MANIFEST_CACHE_KEY, manifest });
};

export const getCachedRawDocument = async (path: string) => {
  const db = getDb();
  if (!db) {
    return null;
  }

  const record = await db.rawDocuments.get(`${READER_RAW_DOCUMENT_CACHE_PREFIX}:${path}`);
  return record ?? null;
};

export const setCachedRawDocument = async (record: RawDocumentRecord) => {
  const db = getDb();
  if (!db) {
    return;
  }

  await db.rawDocuments.put({
    ...record,
    key: `${READER_RAW_DOCUMENT_CACHE_PREFIX}:${record.path}`,
  });
};

export const getCachedParsedDocument = async (path: string) => {
  const db = getDb();
  if (!db) {
    return null;
  }

  const record = await db.parsedDocuments.get(`${READER_PARSED_DOCUMENT_CACHE_PREFIX}:${path}`);
  return record?.document ?? null;
};

export const setCachedParsedDocument = async (document: MantraDocument) => {
  const db = getDb();
  if (!db) {
    return;
  }

  await db.parsedDocuments.put({
    key: `${READER_PARSED_DOCUMENT_CACHE_PREFIX}:${document.sourcePath}`,
    path: document.sourcePath,
    document,
  });
};

export const clearCachedDocument = async (path: string) => {
  const db = getDb();
  if (!db) {
    return;
  }

  await Promise.all([
    db.rawDocuments.delete(`${READER_RAW_DOCUMENT_CACHE_PREFIX}:${path}`),
    db.parsedDocuments.delete(`${READER_PARSED_DOCUMENT_CACHE_PREFIX}:${path}`),
  ]);
};
