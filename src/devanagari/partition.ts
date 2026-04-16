import type { CuratedInventories } from './curatedInventories.ts';
import type { GenerationContext, TemplateFamily } from './types.ts';

export interface PartitionDescriptor {
  id: string;
  ordinal: number;
  family: TemplateFamily;
  baseKind: 'consonant' | 'vowel';
  baseIndex: number;
}

const supportsVowelBase = (family: TemplateFamily) => family === 'plain' || family === 'ending' || family === 'vedic';
export const buildPartitions = (context: GenerationContext, inventories: CuratedInventories): PartitionDescriptor[] => {
  const partitions: PartitionDescriptor[] = [];
  let ordinal = 0;

  for (const family of context.templates) {
    inventories.consonants.forEach((_, baseIndex) => {
      partitions.push({
        id: `${family}:consonant:${baseIndex.toString().padStart(4, '0')}`,
        ordinal: ordinal++,
        family,
        baseKind: 'consonant',
        baseIndex,
      });
    });

    if (supportsVowelBase(family)) {
      inventories.vowels.forEach((_, baseIndex) => {
        partitions.push({
          id: `${family}:vowel:${baseIndex.toString().padStart(4, '0')}`,
          ordinal: ordinal++,
          family,
          baseKind: 'vowel',
          baseIndex,
        });
      });
    }
  }

  return partitions;
};
