import { expect, test } from '@playwright/test';

import {
  DEFAULT_DISPLAY_SETTINGS,
  normalizeDisplaySettings,
} from './src/store/useFlowStore';
import {
  formatSourceForScript,
  normalizeDevanagariDisplayText,
  transliterate,
  detransliterate,
} from './src/lib/vedic/utils';

const DEVANAGARI_PRESET_MATRIX = [
  {
    preset: 'noto-sans',
    expectPlainUnicode: true,
    expectLegacyPraGlyph: false,
  },
  {
    preset: 'siddhanta',
    expectPlainUnicode: true,
    expectLegacyPraGlyph: false,
  },
  {
    preset: 'chandas',
    expectPlainUnicode: false,
    expectLegacyPraGlyph: true,
  },
  {
    preset: 'sanskrit2003',
    expectPlainUnicode: false,
    expectLegacyPraGlyph: true,
  },
] as const;

test.describe('transliteration and display invariants', () => {
  test('default display preset stays siddhanta', () => {
    expect(DEFAULT_DISPLAY_SETTINGS.sanskritFontPreset).toBe('siddhanta');
    expect(normalizeDisplaySettings(undefined).sanskritFontPreset).toBe('siddhanta');
  });

  test('core Sanskrit canaries round-trip canonically', () => {
    expect(detransliterate('श्री')).toBe('shrI');
    expect(transliterate('shrI').unicode).toBe('श्री');
    expect(detransliterate('श्रीसूक्तम्')).toBe('shrIsUktam');
    expect(transliterate('shrIsUktam').unicode).toBe('श्रीसूक्तम्');
  });

  test('plain Unicode presets keep श्री and प्र plain', () => {
    expect(normalizeDevanagariDisplayText('प्र', 'noto-sans')).toBe('प्र');
    expect(normalizeDevanagariDisplayText('प्र', 'siddhanta')).toBe('प्र');
    expect(formatSourceForScript('shrIsUktam', 'devanagari', {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }, {
      sanskritFontPreset: 'noto-sans',
    })).toBe('श्रीसूक्तम्');
    expect(formatSourceForScript('shrIsUktam', 'devanagari', {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }, {
      sanskritFontPreset: 'siddhanta',
    })).toBe('श्रीसूक्तम्');
    expect(formatSourceForScript('pratha_masya_', 'devanagari', {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }, {
      sanskritFontPreset: 'siddhanta',
    })).toBe('प्रथ॒मस्य॒');
  });

  test('legacy compatibility presets may still use the private-use pra glyph', () => {
    expect(normalizeDevanagariDisplayText('प्र', 'chandas')).toBe('');
    expect(normalizeDevanagariDisplayText('प्र', 'sanskrit2003')).toBe('');
    expect(formatSourceForScript('pratha_masya_', 'devanagari', {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }, {
      sanskritFontPreset: 'chandas',
    })).toBe('थ॒मस्य॒');
    expect(formatSourceForScript('pratha_masya_', 'devanagari', {
      romanOutputStyle: 'canonical',
      tamilOutputStyle: 'precision',
    }, {
      sanskritFontPreset: 'sanskrit2003',
    })).toBe('थ॒मस्य॒');
  });

  test('font preset matrix stays explicit', () => {
    for (const row of DEVANAGARI_PRESET_MATRIX) {
      const rendered = normalizeDevanagariDisplayText('प्र', row.preset);
      expect(rendered === 'प्र').toBe(row.expectPlainUnicode);
      expect(rendered === '').toBe(row.expectLegacyPraGlyph);
    }
  });

  test('display normalization keeps visarga ordering stable under the supported presets', () => {
    expect(normalizeDevanagariDisplayText('नम॑ः', 'siddhanta')).toBe('नमः॑');
    expect(normalizeDevanagariDisplayText('नम॑ः', 'sanskrit2003')).toBe('नमः॑');
    expect(normalizeDevanagariDisplayText('नम॑ः', 'chandas')).toBe('नम॑ः');
    expect(normalizeDevanagariDisplayText('नम॑ः', 'sampradaya')).toBe('नम॑ः');
  });
});
