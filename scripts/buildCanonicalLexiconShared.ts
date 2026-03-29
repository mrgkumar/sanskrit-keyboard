import { stripDevanagariLexicalMarks } from '../test-support/corpusText.ts';
import { normalizeForLexicalLookup } from '../src/lib/vedic/lexicalNormalization.ts';
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
    ? normalizeForLexicalLookup(rawItrans)
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
  const validationUnicode = transliterate(rawItrans).unicode;
  const comparableForwardUnicode = extracted.normalizeForLexicon
    ? stripDevanagariLexicalMarks(validationUnicode)
    : validationUnicode;
  const forwardStatus: CanonicalMappingRecord['forwardStatus'] =
    comparableForwardUnicode === expectedUnicode ? 'exact_pass' : 'fail';

  return {
    id: extracted.id,
    devanagari: expectedUnicode,
    itrans: lexicalItrans,
    originalRoman: extracted.originalRoman,
    source: extracted.source,
    score: extracted.score,
    forwardUnicode: validationUnicode,
    forwardStatus,
  };
};
