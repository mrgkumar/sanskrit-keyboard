// app/src/store/flowStoreSegmentation.ts
import { transliterate } from '@/lib/vedic/utils';
import { CanonicalBlock, Segment } from './types';

export const isLongBlockSource = (source: string) =>
  source.length > 100 || source.split(/[\s|]+/).filter(Boolean).length > 10;

export const splitIntoBlockSources = (source: string): string[] =>
  source
    .replace(/\r/g, '')
    .split(/\n\s*\n|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export const createSegments = (source: string): Segment[] => {
  const segments: Segment[] = [];
  let currentOffset = 0;
  let segmentId = 0;

  const delimiters = /(\s+|[.,;!?|]+)/;
  const parts = source.split(delimiters).filter((part) => part.length > 0);

  let tempSegmentSource = '';
  let tempSegmentStartOffset = 0;

  const addCurrentSegment = () => {
    if (tempSegmentSource.length > 0) {
      segments.push({
        id: `seg-${segmentId++}`,
        source: tempSegmentSource,
        rendered: transliterate(tempSegmentSource).unicode,
        startOffset: tempSegmentStartOffset,
        endOffset: tempSegmentStartOffset + tempSegmentSource.length,
      });
      tempSegmentSource = '';
    }
  };

  for (const part of parts) {
    if (tempSegmentSource.length + part.length > 50 && tempSegmentSource.length > 0) {
      addCurrentSegment();
      tempSegmentStartOffset = currentOffset;
    } else if (tempSegmentSource.length === 0) {
      tempSegmentStartOffset = currentOffset;
    }
    tempSegmentSource += part;
    currentOffset += part.length;
  }

  addCurrentSegment();

  return segments;
};

export const createBlockFromSource = (
  source: string,
  title: string,
  options?: { disableAutoSegmentation?: boolean }
): CanonicalBlock => {
  const disableAutoSegmentation = options?.disableAutoSegmentation ?? false;
  const type = !disableAutoSegmentation && isLongBlockSource(source) ? 'long' : 'short';
  const block: CanonicalBlock = {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    disableAutoSegmentation,
    source,
    rendered: transliterate(source).unicode,
  };

  if (type === 'long') {
    block.segments = createSegments(source);
  }

  return block;
};

export const createBlankBlock = (): CanonicalBlock => ({
  id: `block-${Date.now()}`,
  type: 'short',
  title: 'Untitled Block',
  disableAutoSegmentation: true,
  source: '',
  rendered: '',
});
