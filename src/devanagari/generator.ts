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

const makeEntry = (
  text: string,
  templateId: string,
  partition: PartitionDescriptor,
  seed: number,
  categoriesUsed: string[],
  notes: string[]
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
    categoriesUsed: uniqueSorted(categoriesUsed),
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

const getSuffixPool = (inventories: CuratedInventories, context: GenerationContext, family: PartitionDescriptor['family'], baseKind: PartitionDescriptor['baseKind']) => {
  const suffixes = [...inventories.binduSigns];
  if (family === 'plain' && baseKind === 'consonant') {
    suffixes.unshift(inventories.nukta);
  }
  if (context.includeGeneralCombiningMarks) {
    suffixes.push(...inventories.combiningMarks);
  }
  return suffixes.length > 0 ? suffixes : inventories.binduSigns;
};

const getVedicPool = (inventories: CuratedInventories, context: GenerationContext) =>
  context.includeVedic ? [...inventories.vedicSigns] : [];

const buildTextForPartition = (
  partition: PartitionDescriptor,
  context: GenerationContext,
  inventories: CuratedInventories,
  index: number
) => {
  const basePool = partition.baseKind === 'consonant' ? inventories.consonants : inventories.vowels;
  const base = basePool[partition.baseIndex];
  const family = partition.family;
  const remainingSlots =
    family === 'virama' ? context.length - 3 : family === 'matra' ? context.length - 2 : family === 'vedic' ? context.length - 3 : context.length - 1;

  if (remainingSlots < 0) {
    return null;
  }

  if (family === 'virama') {
    const followerPool = inventories.consonants;
    const suffixPool = getSuffixPool(inventories, context, family, partition.baseKind);
    const radices = [followerPool.length, ...Array.from({ length: remainingSlots }, () => suffixPool.length)];
    const digits = digitsFromIndex(index, radices);
    const follower = followerPool[digits[0]];
    const suffixes = digits.slice(1).map((digit) => suffixPool[digit]);
    return stableJoin([base, inventories.virama, follower, ...suffixes]);
  }

  if (family === 'matra') {
    const matraPool = inventories.dependentVowelSigns;
    const suffixPool = getSuffixPool(inventories, context, family, partition.baseKind);
    const radices = [matraPool.length, ...Array.from({ length: remainingSlots }, () => suffixPool.length)];
    const digits = digitsFromIndex(index, radices);
    const matra = matraPool[digits[0]];
    const suffixes = digits.slice(1).map((digit) => suffixPool[digit]);
    return stableJoin([base, matra, ...suffixes]);
  }

  if (family === 'vedic') {
    const suffixPool = getSuffixPool(inventories, context, family, partition.baseKind);
    const vedicPool = getVedicPool(inventories, context);
    const trailingCount = 2;
    const prefixCount = context.length - trailingCount - 1;
    if (prefixCount < 0 || vedicPool.length === 0) {
      return null;
    }
    const radices = [...Array.from({ length: prefixCount }, () => suffixPool.length), vedicPool.length, vedicPool.length];
    const digits = digitsFromIndex(index, radices);
    const suffixes = digits.slice(0, prefixCount).map((digit) => suffixPool[digit]);
    const vedicTail = digits.slice(prefixCount).map((digit) => vedicPool[digit]);
    return stableJoin([base, ...suffixes, ...vedicTail]);
  }

  const suffixPool = getSuffixPool(inventories, context, family, partition.baseKind);
  const radices = Array.from({ length: remainingSlots }, () => suffixPool.length);
  const digits = digitsFromIndex(index, radices);
  const suffixes = digits.map((digit) => suffixPool[digit]);
  return stableJoin([base, ...suffixes]);
};

const partitionTemplateId = (partition: PartitionDescriptor) => `${partition.family}:${partition.baseKind}`;

export const estimatePartitionCount = (
  partition: PartitionDescriptor,
  context: GenerationContext,
  inventories: CuratedInventories
) => {
  const suffixPool = getSuffixPool(inventories, context, partition.family, partition.baseKind);
  if (partition.family === 'virama') {
    return product([
      inventories.consonants.length,
      ...Array.from({ length: Math.max(0, context.length - 3) }, () => suffixPool.length),
    ]);
  }
  if (partition.family === 'matra') {
    return product([
      inventories.dependentVowelSigns.length,
      ...Array.from({ length: Math.max(0, context.length - 2) }, () => suffixPool.length),
    ]);
  }
  if (partition.family === 'vedic') {
    return product([
      ...Array.from({ length: Math.max(0, context.length - 3) }, () => suffixPool.length),
      inventories.vedicSigns.length,
      inventories.vedicSigns.length,
    ]);
  }
  return product(Array.from({ length: Math.max(0, context.length - 1) }, () => suffixPool.length));
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

    const entry = makeEntry(
      text,
      partitionTemplateId(partition),
      partition,
      context.seed,
      Array.from(text).map((char) => {
        if (inventories.consonants.includes(char)) return 'consonant';
        if (inventories.vowels.includes(char)) return 'independentVowel';
        if (inventories.dependentVowelSigns.includes(char)) return 'dependentVowelSign';
        if (char === inventories.virama) return 'virama';
        if (char === inventories.nukta) return 'nukta';
        if (inventories.binduSigns.includes(char)) return 'binduSign';
        if (inventories.vedicSigns.includes(char)) return 'vedicSign';
        if (inventories.combiningMarks.includes(char)) return 'combiningMarkGeneral';
        return 'excluded';
      }),
      ['valid']
    );
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
    items,
    hasMore,
    nextCursor,
  };
};
