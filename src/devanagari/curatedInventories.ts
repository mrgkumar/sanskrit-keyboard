import { SOURCE_INVENTORY } from './sourceInventory.ts';
import type { ClassificationReport } from './types.ts';

export interface CuratedInventories {
  consonants: string[];
  consonantHosts: string[];
  vowels: string[];
  dependentVowelSigns: string[];
  virama: string;
  nukta: string;
  binduSigns: string[];
  vedicSigns: string[];
  combiningMarks: string[];
  symbols: string[];
}

export interface CuratedInventoryOptions {
  includeExtendedConsonants?: boolean;
  includeVedic?: boolean;
  includeGeneralCombiningMarks?: boolean;
  includeSymbols?: boolean;
}

const uniq = (values: string[]) => [...new Set(values)];

export const buildCuratedInventories = (
  report: ClassificationReport,
  options: CuratedInventoryOptions = {}
): CuratedInventories => {
  const consonants = uniq([
    ...SOURCE_INVENTORY.baseConsonants,
    ...(options.includeExtendedConsonants ? SOURCE_INVENTORY.extendedConsonants : []),
  ]);
  const vowels = uniq(SOURCE_INVENTORY.independentVowels);
  const dependentVowelSigns = uniq(SOURCE_INVENTORY.dependentVowelSigns);
  const binduSigns = uniq(SOURCE_INVENTORY.binduSigns);
  const vedicSigns = options.includeVedic ? uniq(SOURCE_INVENTORY.vedicSigns) : [];
  const symbols = options.includeSymbols ? uniq(SOURCE_INVENTORY.symbols) : [];
  const combiningMarks = options.includeGeneralCombiningMarks
    ? uniq(
        report.nonDevanagariCombiningMarks.length > 0
          ? report.nonDevanagariCombiningMarks
          : SOURCE_INVENTORY.combiningMarkRanges.flatMap((range) =>
              Array.from({ length: range.end - range.start + 1 }, (_, index) =>
                String.fromCodePoint(range.start + index)
              )
            )
      )
    : [];

  return {
    consonants,
    consonantHosts: consonants,
    vowels,
    dependentVowelSigns,
    virama: SOURCE_INVENTORY.virama[0],
    nukta: SOURCE_INVENTORY.nukta[0],
    binduSigns,
    vedicSigns,
    combiningMarks,
    symbols,
  };
};
