import type { MantraNode } from './types';

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

export const deriveDocumentTitleFromNodes = (nodes: MantraNode[], fallbackTitle: string) => {
  const titleNode = nodes.find(
    (node) =>
      (node.type === 'chapter' || node.type === 'section' || node.type === 'subsection') &&
      node.text.trim(),
  );

  return titleNode?.text.trim() || fallbackTitle;
};

export interface DocumentOutlineEntry {
  id: string;
  label: string;
  level: 1 | 2 | 3;
}

export const deriveDocumentOutline = (nodes: MantraNode[]) =>
  nodes
    .filter(
      (node): node is Extract<MantraNode, { type: 'chapter' | 'section' | 'subsection' }> =>
        node.type === 'chapter' || node.type === 'section' || node.type === 'subsection',
    )
    .map((node) => ({
      id: node.id,
      label: node.text.trim(),
      level: node.type === 'chapter' ? 1 : node.type === 'section' ? 2 : 3,
    }))
    .filter((entry) => Boolean(entry.label));
