export const TAMIL_PRECISION_MODE_NAMES = {
  compatibility: 'baraha-tamil',
  precision: 'sanskrit-tamil-precision',
} as const;

export const TAMIL_PRECISION_SUPERSCRIPT_MARKERS = {
  aspiratedVoiceless: { rich: '²', fallback: '^2' },
  voicedUnaspirated: { rich: '³', fallback: '^3' },
  voicedAspirated: { rich: '⁴', fallback: '^4' },
} as const;

export const TAMIL_PRECISION_VOCALIC_TOKENS = {
  'R^i': { rich: 'ரு¹', fallback: 'ரு<R>', ordinaryTamil: 'ரு' },
  'R^I': { rich: 'ரூ¹', fallback: 'ரூ<R>', ordinaryTamil: 'ரூ' },
  'L^i': { rich: 'லு¹', fallback: 'லு<L>', ordinaryTamil: 'லு' },
  'L^I': { rich: 'லூ¹', fallback: 'லூ<L>', ordinaryTamil: 'லூ' },
} as const;

export const TAMIL_PRECISION_MARK_TOKENS = {
  M: 'ஂ',
  ':': 'ஃ',
} as const;

export const TAMIL_PRECISION_PHASE_ONE_EXCLUSIONS = [
  'vedic-accents-output',
  'tamil-script-input',
] as const;

export const TAMIL_PRECISION_RESERVED_BARAHA_CONTROL_TOKENS = ['^', '^^'] as const;

const TAMIL_PRECISION_CANONICAL_FRAGMENT_BY_VARIANT = new Map<string, string>([
  ['க²', 'க²'],
  ['க^2', 'க²'],
  ['க³', 'க³'],
  ['க^3', 'க³'],
  ['க⁴', 'க⁴'],
  ['க^4', 'க⁴'],
  ['ரு¹', 'ரு¹'],
  ['ரு<R>', 'ரு¹'],
  ['ரூ¹', 'ரூ¹'],
  ['ரூ<R>', 'ரூ¹'],
  ['லு¹', 'லு¹'],
  ['லு<L>', 'லு¹'],
  ['லூ¹', 'லூ¹'],
  ['லூ<L>', 'லூ¹'],
]);

export const canonicalizeTamilPrecisionFragment = (value: string) =>
  TAMIL_PRECISION_CANONICAL_FRAGMENT_BY_VARIANT.get(value) ?? null;

export const isTamilPrecisionSuperscriptFallback = (value: string) => /^\p{Script=Tamil}\^([234])$/u.test(value);
