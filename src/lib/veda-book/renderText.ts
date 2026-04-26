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

export type ReaderSourceScript = 'devanagari' | 'tamil' | 'roman' | 'mixed' | 'unknown';

const DEVANAGARI_SCRIPT_PATTERN = /[\p{Script=Devanagari}]/gu;
const TAMIL_SCRIPT_PATTERN = /[\p{Script=Tamil}]/gu;
const LATIN_SCRIPT_PATTERN = /[\p{Script=Latin}]/gu;

const countScriptMatches = (value: string, pattern: RegExp) => value.match(pattern)?.length ?? 0;

export const detectReaderSourceScript = (value: string): ReaderSourceScript => {
  const devanagariCount = countScriptMatches(value, DEVANAGARI_SCRIPT_PATTERN);
  const tamilCount = countScriptMatches(value, TAMIL_SCRIPT_PATTERN);
  const latinCount = countScriptMatches(value, LATIN_SCRIPT_PATTERN);

  const counts: Array<[ReaderSourceScript, number]> = [
    ['devanagari', devanagariCount],
    ['tamil', tamilCount],
    ['roman', latinCount],
  ];

  const nonZeroCounts = counts.filter(([, count]) => count > 0);
  if (nonZeroCounts.length === 0) {
    return 'unknown';
  }

  if (nonZeroCounts.length === 1) {
    return nonZeroCounts[0][0];
  }

  const maxCount = Math.max(...nonZeroCounts.map(([, count]) => count));
  const dominantScripts = nonZeroCounts.filter(([, count]) => count === maxCount);
  return dominantScripts.length === 1 ? dominantScripts[0][0] : 'mixed';
};

export const formatReaderSourceScriptLabel = (script: ReaderSourceScript) => {
  switch (script) {
    case 'devanagari':
      return 'Devanagari';
    case 'tamil':
      return 'Tamil';
    case 'roman':
      return 'Roman';
    case 'mixed':
      return 'Mixed script';
    default:
      return 'Unknown';
  }
};
