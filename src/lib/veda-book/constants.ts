export const VEDA_BOOK_REPO = 'stotrasamhita/vedamantra-book';
export const VEDA_BOOK_BRANCH = 'master';
export const VEDA_BOOK_RAW_BASE =
  'https://raw.githubusercontent.com/stotrasamhita/vedamantra-book/master';
export const VEDA_BOOK_MANTRAS_INDEX_PATH = 'mantras.tex';

export const READER_PREFERENCES_STORAGE_KEY = 'veda-reader-preferences-v1';
export const READER_LAST_READ_POSITIONS_STORAGE_KEY = 'veda-reader-last-read-positions-v1';

export const READER_CACHE_PREFIX = 'veda-reader';
export const READER_CACHE_SCHEMA_VERSION = 'v2';

export const readerCacheKey = (scope: string) => `${READER_CACHE_PREFIX}:${READER_CACHE_SCHEMA_VERSION}:${scope}`;

export const READER_MANIFEST_CACHE_KEY = readerCacheKey('manifest');
export const READER_RAW_DOCUMENT_CACHE_PREFIX = readerCacheKey('raw');
export const READER_PARSED_DOCUMENT_CACHE_PREFIX = readerCacheKey('parsed');
