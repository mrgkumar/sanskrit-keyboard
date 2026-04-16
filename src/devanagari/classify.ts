import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE_INVENTORY } from './sourceInventory.ts';
import type {
  ClassifiedCodePoint,
  ClassificationReport,
  InventoryCategory,
  InventorySourceItem,
  SourceInventory,
  SourceRange,
} from './types.ts';

const hex = (codePoint: number) => codePoint.toString(16).toUpperCase().padStart(4, '0');
const charFromCodePoint = (codePoint: number) => String.fromCodePoint(codePoint);
const isDevanagariBlock = (codePoint: number) => codePoint >= 0x0900 && codePoint <= 0x097f;
const isPrivateUse = (codePoint: number) =>
  (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
  (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
  (codePoint >= 0x100000 && codePoint <= 0x10fffd);

const expandRange = (range: SourceRange): InventorySourceItem[] => {
  const items: InventorySourceItem[] = [];
  for (let codePoint = range.start; codePoint <= range.end; codePoint++) {
    items.push({
      group: 'combiningMarkRanges',
      index: codePoint - range.start,
      text: charFromCodePoint(codePoint),
      codePoints: [codePoint],
      isRange: true,
      rangeLabel: range.label,
    });
  }
  return items;
};

const toSourceItems = (inventory: SourceInventory): InventorySourceItem[] => {
  const items: InventorySourceItem[] = [];
  (Object.entries(inventory) as Array<[keyof SourceInventory, SourceInventory[keyof SourceInventory]]>).forEach(
    ([group, values]) => {
      values.forEach((value, index) => {
        if (typeof value === 'string') {
          items.push({
            group,
            index,
            text: value,
            codePoints: Array.from(value, (ch) => ch.codePointAt(0) ?? 0),
            isRange: false,
          });
          return;
        }

        items.push(...expandRange(value).map((item) => ({ ...item, group })));
      });
    }
  );
  return items;
};

export const classifyCodePoint = (codePoint: number): InventoryCategory => {
  const char = charFromCodePoint(codePoint);
  if (SOURCE_INVENTORY.baseConsonants.includes(char)) return 'baseConsonant';
  if (SOURCE_INVENTORY.extendedConsonants.includes(char)) return 'extendedConsonant';
  if (SOURCE_INVENTORY.independentVowels.includes(char)) return 'independentVowel';
  if (SOURCE_INVENTORY.dependentVowelSigns.includes(char)) return 'dependentVowelSign';
  if (SOURCE_INVENTORY.virama.includes(char)) return 'virama';
  if (SOURCE_INVENTORY.nukta.includes(char)) return 'nukta';
  if (SOURCE_INVENTORY.binduSigns.includes(char)) return 'binduSign';
  if (SOURCE_INVENTORY.vedicSigns.includes(char)) return 'vedicSign';
  if (SOURCE_INVENTORY.punctuation.includes(char)) return 'punctuation';
  if (SOURCE_INVENTORY.symbols.includes(char)) return 'symbol';
  if (SOURCE_INVENTORY.combiningMarkRanges.some((range) => codePoint >= range.start && codePoint <= range.end)) {
    return 'combiningMarkGeneral';
  }
  if (
    SOURCE_INVENTORY.vedicRanges.some((range) => codePoint >= range.start && codePoint <= range.end) &&
    !SOURCE_INVENTORY.vedicSigns.includes(char)
  ) {
    return 'vedicSign';
  }
  if (isPrivateUse(codePoint) || SOURCE_INVENTORY.privateUseSamples.includes(char)) {
    return 'privateUseOrFontSpecific';
  }
  if (isDevanagariBlock(codePoint)) return 'excluded';
  return 'excluded';
};

export const classifyInventory = (inventory: SourceInventory = SOURCE_INVENTORY): ClassificationReport => {
  const rawItems = toSourceItems(inventory);
  const seen = new Map<number, ClassifiedCodePoint>();
  const duplicates = new Set<string>();
  const unknownCodePoints = new Set<string>();
  const privateUseCodePoints = new Set<string>();
  const nonDevanagariCombiningMarks = new Set<string>();
  const includedConsonants = new Set<string>();
  const excludedConsonants = new Set<string>();

  const countsByCategory = {
    baseConsonant: 0,
    extendedConsonant: 0,
    independentVowel: 0,
    dependentVowelSign: 0,
    virama: 0,
    nukta: 0,
    binduSign: 0,
    vedicSign: 0,
    combiningMarkGeneral: 0,
    punctuation: 0,
    symbol: 0,
    privateUseOrFontSpecific: 0,
    excluded: 0,
  } satisfies Record<InventoryCategory, number>;

  for (const item of rawItems) {
    for (const codePoint of item.codePoints) {
      const char = charFromCodePoint(codePoint);
      const category = classifyCodePoint(codePoint);
      countsByCategory[category]++;
      if (category === 'baseConsonant' || category === 'extendedConsonant') {
        includedConsonants.add(char);
      } else if (SOURCE_INVENTORY.baseConsonants.includes(char) || SOURCE_INVENTORY.extendedConsonants.includes(char)) {
        excludedConsonants.add(char);
      }

      if (category === 'privateUseOrFontSpecific') {
        privateUseCodePoints.add(char);
      }

      if (category === 'combiningMarkGeneral') {
        nonDevanagariCombiningMarks.add(char);
      }

      if (!seen.has(codePoint)) {
        seen.set(codePoint, {
          codePoint,
          char,
          hex: `U+${hex(codePoint)}`,
          category,
          sourceGroups: [item.group],
          sourceCount: 1,
          notes: [
            item.isRange ? `range:${item.rangeLabel ?? item.group}` : `source:${item.group}`,
            category === 'privateUseOrFontSpecific' ? 'private-use-or-font-specific' : '',
          ].filter(Boolean),
        });
      } else {
        const entry = seen.get(codePoint)!;
        entry.sourceGroups.push(item.group);
        entry.sourceCount++;
        duplicates.add(char);
      }

      if (category === 'excluded' && !isDevanagariBlock(codePoint)) {
        unknownCodePoints.add(char);
      }
    }
  }

  const classification = [...seen.values()].sort((a, b) => a.codePoint - b.codePoint);
  const report: ClassificationReport = {
    classification,
    countsByCategory,
    includedConsonants: [...includedConsonants].sort(),
    excludedConsonants: [...excludedConsonants].sort(),
    unknownCodePoints: [...unknownCodePoints].sort(),
    duplicates: [...duplicates].sort(),
    privateUseCodePoints: [...privateUseCodePoints].sort(),
    nonDevanagariCombiningMarks: [...nonDevanagariCombiningMarks].sort(),
  };
  return report;
};

export const classificationToJson = (report: ClassificationReport) => JSON.stringify(report, null, 2);

export const writeInventoryArtifacts = (outputRoot = join(process.cwd(), 'output', 'inventory')) => {
  const report = classifyInventory();
  mkdirSync(outputRoot, { recursive: true });
  writeFileSync(join(outputRoot, 'classification.json'), classificationToJson(report));
  writeFileSync(
    join(outputRoot, 'audit.json'),
    JSON.stringify(
      {
        schemaVersion: 1,
        sourceInventoryHash: createHash('sha256')
          .update(JSON.stringify(SOURCE_INVENTORY))
          .digest('hex'),
        countsByCategory: report.countsByCategory,
        includedConsonants: report.includedConsonants,
        excludedConsonants: report.excludedConsonants,
        unknownCodePoints: report.unknownCodePoints,
        duplicates: report.duplicates,
        privateUseCodePoints: report.privateUseCodePoints,
        nonDevanagariCombiningMarks: report.nonDevanagariCombiningMarks,
      },
      null,
      2
    )
  );
  return report;
};
