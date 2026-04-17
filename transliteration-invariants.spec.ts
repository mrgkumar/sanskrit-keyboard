import { expect, test, type Locator, type Page } from '@playwright/test';

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

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

const loadDefaultSession = async (page: Page) => {
  await page.addInitScript((keys) => {
    window.localStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sanskrit-keyboard.session.v2.'))
      .forEach((key) => window.localStorage.removeItem(key));

    window.localStorage.setItem('sanskrit-keyboard-visited', 'true');
  }, STORAGE_KEYS_TO_CLEAR);

  await page.goto(APP_URL);

  const newSessionBtn = page.getByRole('button', { name: /New Session/i });
  if (await newSessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newSessionBtn.click();
  }

  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible({ timeout: 15000 });
  page.on('dialog', (dialog) => dialog.accept());
};

const openDisplaySettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByTestId('workspace-tab-display').click();
};

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click();
};

const getFontFamilyTokens = async (locator: Locator) => {
  const fontFamily = await locator.evaluate((node) => getComputedStyle(node as HTMLElement).fontFamily);
  return fontFamily
    .split(',')
    .map((token) => token.trim().replaceAll(/^["']|["']$/g, ''))
    .filter(Boolean);
};

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

  test('Siddhanta renders उदकशान्ति-मन्त्राः without forced shaping artifacts', async ({ page }) => {
    await loadDefaultSession(page);
    await page.getByTestId('sticky-itrans-input').fill('udakashAnti-mantrA:');
    await setReadAs(page, 'devanagari');
    await openDisplaySettings(page);
    await page.getByRole('button', { name: 'Siddhanta' }).click();

    const previewTarget = page.getByTestId('sticky-preview-primary-pane').locator('[data-font-preset="siddhanta"]').first();
    await expect(previewTarget).toContainText('उदकशान्ति-मन्त्राः');

    await page.getByRole('button', { name: 'Document mode' }).click();
    const documentTarget = page.getByTestId('main-document-scroll-container').locator('[data-font-preset="siddhanta"]').first();
    await expect(documentTarget).toContainText('उदकशान्ति-मन्त्राः');

    await page.getByRole('button', { name: 'Read mode' }).click();
    const readTarget = page.getByTestId('document-read-mode').locator('[data-font-preset="siddhanta"]').first();
    await expect(readTarget).toContainText('उदकशान्ति-मन्त्राः');

    await page.getByRole('button', { name: 'Immersive mode' }).click();
    const immersiveTarget = page.getByTestId('document-immersive-mode').locator('[data-font-preset="siddhanta"]').first();
    await expect(immersiveTarget).toContainText('उदकशान्ति-मन्त्राः');
  });

  test('Siddhanta takes precedence across preview, document, read, and immersive modes', async ({ page }) => {
    await loadDefaultSession(page);
    await page.getByTestId('sticky-itrans-input').fill('shrIsUktam shri');
    await setReadAs(page, 'devanagari');
    await openDisplaySettings(page);
    await page.getByRole('button', { name: 'Siddhanta' }).click();

    const previewTarget = page.getByTestId('sticky-preview-primary-pane').locator('[data-font-preset="siddhanta"]').first();
    await expect(previewTarget).toBeVisible();

    const assertLeadingFont = async (locator: ReturnType<Page['locator']>, label: string) => {
      const tokens = await getFontFamilyTokens(locator);
      expect(tokens[0]?.toLowerCase(), `${label} should prefer Siddhanta first`).toContain('siddhanta');
    };

    const assertLoadedSiddhantaFace = async (locator: ReturnType<Page['locator']>, label: string) => {
      const fontFamily = await locator.evaluate((node) => getComputedStyle(node as HTMLElement).fontFamily);
      const sample = await locator.textContent();
      const firstFamilyToken = fontFamily
        .split(',')
        .map((token) => token.trim().replaceAll(/^["']|["']$/g, ''))
        .find(Boolean);
      expect(firstFamilyToken, `${label} should expose a primary font family`).toBeTruthy();

      const loaded = await page.evaluate(
        ({ family, text }) => document.fonts.check(`24px ${family}`, text ?? ''),
        { family: firstFamilyToken as string, text: sample ?? '' }
      );

      expect(loaded, `${label} should have Siddhanta loaded for the sample text`).toBe(true);
    };

    const firstSiddhantaIn = (containerTestId: string) =>
      page.getByTestId(containerTestId).locator('[data-font-preset="siddhanta"]').first();

    await assertLeadingFont(previewTarget, 'Preview');
    await assertLoadedSiddhantaFace(previewTarget, 'Preview');

    await page.getByRole('button', { name: 'Document mode' }).click();
    const documentTarget = firstSiddhantaIn('main-document-scroll-container');
    await expect(documentTarget).toBeVisible();
    await assertLeadingFont(documentTarget, 'Document');
    await assertLoadedSiddhantaFace(documentTarget, 'Document');

    await page.getByRole('button', { name: 'Read mode' }).click();
    const readTarget = firstSiddhantaIn('document-read-mode');
    await expect(readTarget).toBeVisible();
    await assertLeadingFont(readTarget, 'Read');
    await assertLoadedSiddhantaFace(readTarget, 'Read');

    await page.getByRole('button', { name: 'Immersive mode' }).click();
    const immersiveTarget = firstSiddhantaIn('document-immersive-mode');
    await expect(immersiveTarget).toBeVisible();
    await assertLeadingFont(immersiveTarget, 'Immersive');
    await assertLoadedSiddhantaFace(immersiveTarget, 'Immersive');
  });
});
