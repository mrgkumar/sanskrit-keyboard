import {
  normalizeDevanagariCorpusComparison,
  stripDevanagariLexicalMarks,
} from '../test-support/corpusText.ts';
import {
  normalizeForCanonicalValidation,
  normalizeForCanonicalLexiconTraining,
} from '../src/lib/vedic/lexicalNormalization.ts';
import { detransliterate, transliterate } from '../src/lib/vedic/utils.ts';
import { extractCanonicalRow, type CanonicalRecordConfig } from '../test-support/corpusRegistry.ts';

export interface CanonicalMappingRecord {
  id: string;
  devanagari: string;
  itrans: string;
  originalRoman: string;
  source: string | null;
  score: number | null;
  forwardUnicode: string;
  forwardStatus: 'exact_pass' | 'fail';
}

const repairCanonicalHiatusItrans = ({
  rawItrans,
  expectedUnicode,
  normalizeForLexicon,
}: {
  rawItrans: string;
  expectedUnicode: string;
  normalizeForLexicon: boolean;
}) => {
  const candidates = new Set<string>();
  const queue = [rawItrans];
  const seen = new Set<string>(queue);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const nextVariants = [
      current.replaceAll('ai', 'a/i'),
      current.replaceAll('au', 'a/u'),
      current.replaceAll('_MM~_', ''),
      current.replaceAll('MM~', ''),
      current.replaceAll('_M~_', ''),
      current.replaceAll('M~', ''),
      current.replaceAll('_M_', ''),
      current.replaceAll('M', ''),
    ];

    for (const variant of nextVariants) {
      if (variant === current || seen.has(variant)) {
        continue;
      }

      seen.add(variant);
      queue.push(variant);
      candidates.add(variant);
    }
  }

  for (const candidate of candidates) {
    const validationItrans = normalizeForLexicon
      ? normalizeForCanonicalValidation(candidate)
      : candidate;
    const validationUnicode = transliterate(validationItrans).unicode;
    const comparableForwardUnicode = normalizeForLexicon
      ? stripDevanagariLexicalMarks(validationUnicode)
      : validationUnicode;

    if (
      normalizeDevanagariCorpusComparison(comparableForwardUnicode) !==
      normalizeDevanagariCorpusComparison(expectedUnicode)
    ) {
      continue;
    }

    return {
      lexicalItrans: normalizeForLexicon
        ? normalizeForCanonicalLexiconTraining(candidate)
        : candidate,
      validationUnicode,
      forwardStatus: 'exact_pass' as const,
    };
  }

  return null;
};

export const processCanonicalRow = ({
  row,
  config,
  rowId,
  datasetId,
}: {
  row: Record<string, unknown>;
  config: CanonicalRecordConfig;
  rowId: string;
  datasetId: string;
}): CanonicalMappingRecord | null => {
  const extracted = extractCanonicalRow(config, row, rowId, datasetId);
  if (!extracted) {
    return null;
  }

  const rawItrans =
    config.mode === 'from_itrans' && extracted.itrans
      ? extracted.itrans
      : detransliterate(extracted.devanagari);
  const lexicalItrans = extracted.normalizeForLexicon
    ? normalizeForCanonicalLexiconTraining(rawItrans)
    : rawItrans;

  if (!lexicalItrans || (extracted.normalizeForLexicon && !/[A-Za-z]/.test(lexicalItrans))) {
    return null;
  }

  const expectedUnicode =
    extracted.normalizeForLexicon
      ? stripDevanagariLexicalMarks(extracted.devanagari)
      : config.mode === 'from_itrans' && extracted.devanagari
      ? extracted.devanagari
      : extracted.devanagari;
  const validationItrans = extracted.normalizeForLexicon
    ? normalizeForCanonicalValidation(rawItrans)
    : rawItrans;
  const validationUnicode = transliterate(validationItrans).unicode;
  const comparableForwardUnicode = extracted.normalizeForLexicon
    ? stripDevanagariLexicalMarks(validationUnicode)
    : validationUnicode;
  let forwardStatus: CanonicalMappingRecord['forwardStatus'] =
    normalizeDevanagariCorpusComparison(comparableForwardUnicode) ===
    normalizeDevanagariCorpusComparison(expectedUnicode)
      ? 'exact_pass'
      : 'fail';
  let finalLexicalItrans = lexicalItrans;
  let finalForwardUnicode = validationUnicode;

  if (forwardStatus === 'fail') {
    const repaired = repairCanonicalHiatusItrans({
      rawItrans,
      expectedUnicode,
      normalizeForLexicon: extracted.normalizeForLexicon,
    });

    if (repaired) {
      finalLexicalItrans = repaired.lexicalItrans;
      finalForwardUnicode = repaired.validationUnicode;
      forwardStatus = repaired.forwardStatus;
    }
  }

  return {
    id: extracted.id,
    devanagari: expectedUnicode,
    itrans: finalLexicalItrans,
    originalRoman: extracted.originalRoman,
    source: extracted.source,
    score: extracted.score,
    forwardUnicode: finalForwardUnicode,
    forwardStatus,
  };
};
