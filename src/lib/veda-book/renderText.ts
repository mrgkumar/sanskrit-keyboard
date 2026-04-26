const CAMEL_BOUNDARY_PATTERN = /([a-z0-9])([A-Z])/g;
const NON_ALNUM_BOUNDARY_PATTERN = /[_-]+/g;

export const humanizeIdentifier = (value: string) =>
  value
    .replace(CAMEL_BOUNDARY_PATTERN, '$1 $2')
    .replace(NON_ALNUM_BOUNDARY_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (char) => char.toUpperCase());

export const formatTitleFromPath = (path: string) => {
  const normalized = path.replace(/\\/g, '/').split('/').pop() ?? path;
  const withoutExtension = normalized.replace(/\.tex$/i, '');
  return humanizeIdentifier(withoutExtension);
};

export const normalizeReaderSearchText = (value: string) =>
  value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

export const createReaderNodeId = (prefix: string, index: number) => `${prefix}-${index + 1}`;
