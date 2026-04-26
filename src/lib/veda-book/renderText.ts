import type { OutputScript, OutputTargetSettings } from '@/lib/vedic/mapping';
import { detransliterate, formatSourceForScript, normalizeDevanagariDisplayText, reverseTamilInput } from '@/lib/vedic/utils';
import type { SanskritFontPreset } from '@/store/types';
import type { MantraDocument, MantraNode, ReaderPageSize } from './types';

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
    (node): node is Extract<MantraNode, { type: 'chapter' | 'section' | 'subsection' }> =>
      (node.type === 'chapter' || node.type === 'section' || node.type === 'subsection') &&
      Boolean(node.text.trim()),
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

export type ReaderDisplayScript = 'original' | OutputScript;

const isRenderableReaderScript = (script: ReaderDisplayScript | ReaderSourceScript): script is OutputScript =>
  script === 'roman' || script === 'devanagari' || script === 'tamil';

export const getCanonicalReaderSourceText = (text: string, sourceScript: ReaderSourceScript) => {
  if (!text) {
    return text;
  }

  if (sourceScript === 'devanagari') {
    return detransliterate(text);
  }

  if (sourceScript === 'roman') {
    return text;
  }

  if (sourceScript === 'tamil') {
    const reversed = reverseTamilInput(text, { inputMode: 'tamil-precision', outputMode: 'canonical' });
    return reversed.status === 'success' ? reversed.canonicalRoman : null;
  }

  return null;
};

export const formatReaderDisplayText = (
  text: string,
  displayScript: ReaderDisplayScript,
  sourceScript: ReaderSourceScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: { sanskritFontPreset?: SanskritFontPreset },
) => {
  if (!text) {
    return text;
  }

  if (displayScript === 'original' || !isRenderableReaderScript(displayScript)) {
    return text;
  }

  const canonicalSource = getCanonicalReaderSourceText(text, sourceScript);
  if (canonicalSource === null) {
    if (sourceScript === 'devanagari' && displayScript === 'devanagari') {
      return normalizeDevanagariDisplayText(text, options?.sanskritFontPreset);
    }

    return text;
  }

  if (displayScript === 'devanagari') {
    return normalizeDevanagariDisplayText(
      formatSourceForScript(canonicalSource, 'devanagari', settings, options),
      options?.sanskritFontPreset,
    );
  }

  return formatSourceForScript(canonicalSource, displayScript, settings, options);
};

export const getReaderDisplayScriptLabel = (script: ReaderDisplayScript) =>
  script === 'original' ? 'Original' : formatReaderSourceScriptLabel(script);

const READER_PAGE_SIZE_WIDTHS: Record<ReaderPageSize, string> = {
  a4: '8.27in',
  letter: '8.5in',
  legal: '8.5in',
};

export const getReaderPageSizeLabel = (pageSize: ReaderPageSize) =>
  pageSize === 'a4' ? 'A4' : pageSize === 'letter' ? 'Letter' : 'Legal';

export const getReaderPageSizeWidth = (pageSize: ReaderPageSize) => READER_PAGE_SIZE_WIDTHS[pageSize];

export const formatReaderSearchText = (
  text: string,
  displayScript: ReaderDisplayScript,
  sourceScript: ReaderSourceScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: { sanskritFontPreset?: SanskritFontPreset },
) => {
  const trimmed = text.trim();
  if (!trimmed) {
    return '';
  }

  if (displayScript === 'original') {
    return normalizeReaderSearchText(trimmed);
  }

  const queryScript = detectReaderSourceScript(trimmed);
  const canonicalSource = getCanonicalReaderSourceText(trimmed, queryScript);
  if (canonicalSource === null) {
    return normalizeReaderSearchText(trimmed);
  }

  const renderedQuery =
    displayScript === 'devanagari'
      ? normalizeDevanagariDisplayText(
          formatSourceForScript(canonicalSource, 'devanagari', settings, options),
          options?.sanskritFontPreset,
        )
      : formatSourceForScript(canonicalSource, displayScript, settings, options);

  return normalizeReaderSearchText(renderedQuery);
};

export interface ReaderSearchHit {
  nodeId: string;
  text: string;
  isTitle?: boolean;
}

export const collectReaderSearchHits = (
  document: MantraDocument,
  query: string,
  displayScript: ReaderDisplayScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: { sanskritFontPreset?: SanskritFontPreset },
) => {
  const normalizedQuery = formatReaderSearchText(query, displayScript, detectReaderSourceScript(document.rawTex), settings, options);
  if (!normalizedQuery) {
    return [] as ReaderSearchHit[];
  }

  const sourceScript = detectReaderSourceScript(document.rawTex);
  const hits: ReaderSearchHit[] = [];

  const addIfMatch = (nodeId: string, text: string, isTitle = false) => {
    const normalizedText = normalizeReaderSearchText(text);
    if (normalizedText.includes(normalizedQuery)) {
      hits.push({ nodeId, text, isTitle });
    }
  };

  addIfMatch('reader-document-title', formatReaderDisplayText(document.title, displayScript, sourceScript, settings, options), true);

  for (const node of document.nodes) {
    switch (node.type) {
      case 'chapter':
      case 'section':
      case 'subsection':
      case 'paragraph':
      case 'center':
      case 'raw':
        addIfMatch(node.id, formatReaderDisplayText(node.text, displayScript, sourceScript, settings, options));
        break;
      case 'sourceRef':
        addIfMatch(node.id, formatReaderDisplayText(node.values.join(' · '), displayScript, sourceScript, settings, options));
        break;
      case 'warning':
        addIfMatch(node.id, normalizeReaderSearchText(node.message));
        break;
      default:
        break;
    }
  }

  return hits;
};

const formatReaderNodeText = (
  text: string,
  displayScript: ReaderDisplayScript,
  sourceScript: ReaderSourceScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: { sanskritFontPreset?: SanskritFontPreset },
) => formatReaderDisplayText(text, displayScript, sourceScript, settings, options);

export const serializeReaderDocumentText = (
  document: MantraDocument,
  displayScript: ReaderDisplayScript,
  settings: Pick<OutputTargetSettings, 'romanOutputStyle' | 'tamilOutputStyle'>,
  options?: { sanskritFontPreset?: SanskritFontPreset },
) => {
  const sourceScript = detectReaderSourceScript(document.rawTex);
  const lines: string[] = [];

  const appendBlock = (text: string, blankLineBefore = false) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    if (blankLineBefore && lines.length > 0 && lines[lines.length - 1] !== '') {
      lines.push('');
    }

    lines.push(trimmed);
  };

  appendBlock(formatReaderNodeText(document.title, displayScript, sourceScript, settings, options));

  for (const node of document.nodes) {
    switch (node.type) {
      case 'chapter':
      case 'section':
      case 'subsection':
      case 'paragraph':
      case 'center':
      case 'raw':
        appendBlock(formatReaderNodeText(node.text, displayScript, sourceScript, settings, options), true);
        break;
      case 'sourceRef':
        appendBlock(
          `${node.source}: ${formatReaderNodeText(node.values.join(' · '), displayScript, sourceScript, settings, options)}`,
          true,
        );
        break;
      case 'warning':
        appendBlock(`Warning: ${node.message}`, true);
        break;
      case 'pageBreak':
        lines.push('');
        break;
      default:
        break;
    }
  }

  return lines.join('\n');
};
