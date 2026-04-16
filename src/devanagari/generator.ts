import type { CuratedInventories } from './curatedInventories.ts';
import type { BatchCursor, BatchRequest, CorpusEntry, GenerationContext } from './types.ts';
import type { PartitionDescriptor } from './partition.ts';
import { codePoints, hashText, stableJoin, uniqueSorted } from './utils.ts';
import { validateOrthography } from './validator.ts';

const product = (values: number[]) => values.reduce((acc, value) => acc * value, 1);

const digitsFromIndex = (index: number, radices: number[]) => {
  let remaining = index;
  const digits = new Array(radices.length).fill(0);
  for (let position = radices.length - 1; position >= 0; position--) {
    const radix = radices[position];
    digits[position] = remaining % radix;
    remaining = Math.floor(remaining / radix);
  }
  return digits;
};

const deriveCategoriesUsed = (text: string, inventories: CuratedInventories) =>
  uniqueSorted(
    Array.from(text).map((char) => {
      if (inventories.consonants.includes(char)) return 'consonant';
      if (inventories.vowels.includes(char)) return 'independentVowel';
      if (inventories.dependentVowelSigns.includes(char)) return 'dependentVowelSign';
      if (char === inventories.virama) return 'virama';
      if (char === inventories.nukta) return 'nukta';
      if (inventories.binduSigns.includes(char)) return 'binduSign';
      if (inventories.vedicSigns.includes(char)) return 'vedicSign';
      if (inventories.symbols.includes(char)) return 'symbol';
      if (inventories.combiningMarks.includes(char)) return 'combiningMarkGeneral';
      return 'excluded';
    })
  );

export const materializeEntry = (
  text: string,
  templateId: string,
  partition: PartitionDescriptor,
  seed: number,
  inventories: CuratedInventories,
  notes: string[] = ['valid']
): CorpusEntry => {
  const codePointsHex = codePoints(text).map((codePoint) => `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`);
  return {
    id: hashText(`${seed}|${partition.id}|${templateId}|${text}`).slice(0, 20),
    codePointLength: codePoints(text).length,
    text,
    normalizedNFC: text.normalize('NFC'),
    normalizedNFD: text.normalize('NFD'),
    codePointsHex,
    templateId,
    categoriesUsed: deriveCategoriesUsed(text, inventories),
    hasVirama: text.includes('्'),
    hasMatra: /[ािीुूृॄॢॣॅॆेैॉॊोौऺऻॎॏॕॖॗ]/u.test(text),
    hasIndependentVowel: /^[ऄअआइईउऊऋॠऌॡऍऎएऐऑऒओऔॲॳॴॵॶॷ]/u.test(text),
    hasNukta: text.includes('़'),
    hasBindu: /[ँंःऀ]/u.test(text),
    hasVedicMark: /[॒॑॓॔᳐-᳴꣠-꣱]/u.test(text),
    hasExtendedConsonant: /[क़ख़ग़ज़ड़ढ़फ़य़ॹॺॻॼॾॿꣻ]/u.test(text),
    notes,
  };
};

const makeEntry = (
  text: string,
  templateId: string,
  partition: PartitionDescriptor,
  seed: number,
  inventories: CuratedInventories,
  notes: string[]
): CorpusEntry => {
  return materializeEntry(text, templateId, partition, seed, inventories, notes);
};

const buildSlotPools = (
  partition: PartitionDescriptor,
  context: GenerationContext,
  inventories: CuratedInventories
) => {
  const remainingSlots = Math.max(0, context.length - 1);

  if (partition.family === 'plain') {
    return Array.from({ length: remainingSlots }, () => inventories.consonants);
  }

  if (partition.family === 'virama') {
    if (context.length < 3) {
      return [];
    }

    return [
      [inventories.virama],
      inventories.consonants,
      ...Array.from({ length: context.length - 3 }, () => inventories.consonants),
    ];
  }

  if (partition.family === 'matra') {
    if (context.length < 2) {
      return [];
    }

    return [
      inventories.dependentVowelSigns,
      ...Array.from({ length: context.length - 2 }, () => inventories.consonants),
    ];
  }

  if (partition.family === 'ending') {
    if (remainingSlots === 0) {
      return [];
    }

    return [
      ...Array.from({ length: Math.max(0, remainingSlots - 1) }, () => inventories.consonants),
      context.includeSymbols && inventories.symbols.length > 0
        ? [...inventories.binduSigns, ...inventories.symbols]
        : inventories.binduSigns,
    ];
  }

  if (!context.includeVedic || inventories.vedicSigns.length === 0) {
    return [];
  }

  if (remainingSlots === 0) {
    return [inventories.vedicSigns];
  }

  return [
    ...Array.from({ length: Math.max(0, remainingSlots - 1) }, () => inventories.consonants),
    inventories.vedicSigns,
  ];
};

const getRadices = (slotPools: string[][]) => slotPools.map((pool) => pool.length);

const buildTextForPartition = (
  partition: PartitionDescriptor,
  context: GenerationContext,
  inventories: CuratedInventories,
  index: number
) => {
  const basePool = partition.baseKind === 'consonant' ? inventories.consonants : inventories.vowels;
  const base = basePool[partition.baseIndex];
  const slotPools = buildSlotPools(partition, context, inventories);

  if (slotPools.length === 0) {
    return null;
  }

  const radices = getRadices(slotPools);
  const digits = digitsFromIndex(index, radices);
  const suffixes = digits.map((digit, slotIndex) => slotPools[slotIndex][digit]);
  return stableJoin([base, ...suffixes]);
};

const partitionTemplateId = (partition: PartitionDescriptor) => `${partition.family}:${partition.baseKind}`;

export const estimatePartitionCount = (
  partition: PartitionDescriptor,
  context: GenerationContext,
  inventories: CuratedInventories
) => {
  const slotPools = buildSlotPools(partition, context, inventories);
  if (slotPools.length === 0) {
    return 0;
  }

  return product(getRadices(slotPools));
};

export const generatePartitionBatch = (
  partition: PartitionDescriptor,
  cursor: BatchCursor,
  request: BatchRequest,
  context: GenerationContext,
  inventories: CuratedInventories
) => {
  const total = estimatePartitionCount(partition, context, inventories);
  const items: CorpusEntry[] = [];
  const start = cursor.entryIndex;
  let index = start;

  while (index < total && items.length < request.batchSize) {
    const text = buildTextForPartition(partition, context, inventories, index);
    index++;
    if (!text) {
      continue;
    }

    const validation = validateOrthography(text, { request, inventories });
    if (!validation.valid) {
      continue;
    }

    const entry = makeEntry(text, partitionTemplateId(partition), partition, context.seed, inventories, ['valid']);
    items.push(entry);
  }

  const hasMore = index < total;
  const nextCursor = hasMore
    ? {
        partitionId: partition.id,
        entryIndex: index,
        batchIndex: cursor.batchIndex + 1,
      }
    : undefined;

  return {
    partitionId: partition.id,
    partitionOrdinal: partition.ordinal,
    batchIndex: cursor.batchIndex,
    batchId: `${partition.id}:${cursor.batchIndex.toString().padStart(6, '0')}`,
    templateId: partitionTemplateId(partition),
    items,
    hasMore,
    nextCursor,
  };
};
