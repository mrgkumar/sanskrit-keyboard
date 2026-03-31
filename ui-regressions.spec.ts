import { expect, test, type Page } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils.ts';

const APP_URL = 'http://localhost:3000';
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
  }, STORAGE_KEYS_TO_CLEAR);
  await page.goto(APP_URL);
  await expect(page.locator('textarea')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('textarea')).toHaveValue('');
};

const setRangeValue = async (page: Page, label: string, value: string) => {
  const slider = page.locator('label', { hasText: label }).locator('input[type="range"]').first();
  await slider.focus();
  const currentValue = Number(await slider.inputValue());
  const targetValue = Number(value);
  const stepCount = Math.abs(targetValue - currentValue);
  const key = targetValue >= currentValue ? 'ArrowRight' : 'ArrowLeft';

  for (let index = 0; index < stepCount; index += 1) {
    await slider.press(key);
  }
};

const pasteText = async (page: Page, text: string) => {
  await page.getByTestId('sticky-itrans-input').evaluate((node, pastedText) => {
    const textarea = node as HTMLTextAreaElement;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', pastedText);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: clipboardData,
    });
    textarea.dispatchEvent(pasteEvent);
  }, text);
};

const LONG_SNIPPET =
  "a_rya_mNo vaa e_tannakSha'ttram | yatpuurve_ phalgu'nii | a_rya_meti_ tamaa'hu_ryo dadaa'ti | daana'kaamaa asmai pra_jaa bha'vanti | ya kaa_maye'ta bha_gii syaa_miti' | sa utta'rayo_ phalgu'nyora_gnimaada'dhiita | bhaga'sya_ vaa e_tannakSha'ttram | yadutta're_ phalgu'nii | bha_gye'va bha'vati | kaa_la_ka_~njaa vai naamaasu'raa Asann || 9 || still the font size is large gaaya_triiM gaNeshkumaar shanti shanti gani vidv surya ravi naraayana swami gaNeshkumaar vishveshvari aruna tachCha_myai' shami_tvam | yachCha'mii_maya'ssambhaa_ro bhava'ti | shaantyaa_ apra'daahaaya | a_gnessR^i_STasya' ya_ta: | vika'~NkataM_ bhaa A''rchChat | yada_shani'hatasya vR^i_kShasya' sambhaa_ro bhava'ti | sahR^i'dayame_vaagnimaa dha'tte || 25 ||";

test('delete toast auto-dismisses after a short timeout', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTitle('Delete block').first().click();
  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.waitForTimeout(5600);
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});

test('backspace correction replaces the intended suffix', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.locator('textarea');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('prri');
  await page.keyboard.press('Backspace');

  await expect(page.getByText('Correction Help')).toBeVisible();
  await page.locator('button').filter({ has: page.getByText('RRi') }).first().click();
  await expect(textarea).toHaveValue('pRRi');
});

test('clicking a correction keeps the caret at the replacement point', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.locator('textarea');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('rri');
  await page.keyboard.press('Backspace');

  const correctionButton = page.locator('button').filter({ has: page.getByText('RRi') }).first();
  await correctionButton.click();

  await expect(textarea).toHaveValue('RRi');
  const selectionStart = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart);
  const selectionEnd = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionEnd);
  expect(selectionStart).toBe(3);
  expect(selectionEnd).toBe(3);
});

test('read and review modes visibly change the document view', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await expect(page.getByRole('button', { name: 'Focus' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Review mode' }).click();
  await expect(page.getByText('ITRANS Source').first()).toBeVisible();

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-mode')).toBeVisible();
  await expect(page.getByText('ITRANS Source')).toHaveCount(0);
  await expect(page.getByText('Focused Source')).toHaveCount(0);

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();
  await expect(page.getByTestId('sticky-composer-shell')).toHaveCount(0);
});

test('double-clicking read or immersive text jumps back into edit mode at the clicked word', async ({ page }) => {
  await loadDefaultSession(page);
  const textarea = page.getByTestId('sticky-itrans-input');
  const sample = 'agniM ile purohitaM yajnasya';
  const rendered = transliterate(sample);
  const clickedWord = 'yajnasya';
  const expectedSourceWordStart = sample.indexOf(clickedWord);
  const clickedWordTargetIndex = rendered.sourceToTargetMap[expectedSourceWordStart] ?? 0;

  await textarea.fill(sample);

  await page.getByRole('button', { name: 'Read mode' }).click();
  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();
  await readDocument.locator(`[data-target-index="${clickedWordTargetIndex}"]`).dblclick();

  await expect(page.getByRole('button', { name: 'Review mode' })).toHaveClass(/bg-blue-600/);
  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect(textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).resolves.toBe(expectedSourceWordStart);

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  const immersiveDocument = page.getByTestId('document-immersive-mode');
  await expect(immersiveDocument).toBeVisible();
  await immersiveDocument.locator(`[data-target-index="${clickedWordTargetIndex}"]`).dblclick();

  await expect(page.getByRole('button', { name: 'Review mode' })).toHaveClass(/bg-blue-600/);
  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect(textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).resolves.toBe(expectedSourceWordStart);
});

test('double-clicking deep read text scrolls the review pane to the activated block', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadDefaultSession(page);

  const seedBlocks = [
    'तैत्तिरीयारण्यके प्रथमप्रश्नप्रारम्भः ।। हरिः ओम् ।।',
    'तैत्तिरीयारण्यके द्वितीयप्रश्नप्रारम्भः । हरिः ओम् ।',
    '।। तैत्तिरीयारण्यके तृतीयप्रश्न-प्रारंभः ।। हरिः ओम् ।',
    '।। चतुर्थःप्रश्नःप्रारंभः ।। सन्त्वा सिञ्चामि यजुषा प्रजामायुर्धनञ्च ओम् शान्तिश्शान्तिश्शन्तिः',
    '।। तैत्तिरीयीरण्यके पञ्चमप्रश्नः प्रारंभः ।।  ।। तैत्तिरीयोपनिषत् ।।',
    'तैत्तिरीयारण्यके षष्ठप्रश्नप्रारम्भः । तैत्तिरीयोपनिषत् (- महानारायणोपनिषत्)',
    'अ॒र्य॒म्णो वा ए॒तन्नक्ष॑त्त्रम् । यत्पूर्वे॒ फल्गु॑नी । अ॒र्य॒मेति॒ तमा॑हु॒र्यो ददा॑ति । दान॑कामा अस्मै प्र॒जा भ॑वन्ति ।',
    'य का॒मये॑त भ॒गी स्या॒मिति॑ । स उत्त॑रयो॒ फल्गु॑न्योर॒ग्निमाद॑धीत । भग॑स्य॒ वा ए॒तन्नक्ष॑त्त्रम् । यदुत्त॑रे॒ फल्गु॑नी ।'
  ];
  const multiBlockDevanagari = Array.from({ length: 3 }, (_, index) =>
    seedBlocks.map((line) => `${line} ${index + 1}`)
  ).flat().join('\n');

  await pasteText(page, multiBlockDevanagari);
  await page.getByRole('button', { name: 'Read mode' }).click();

  const readContainer = page.getByTestId('main-document-scroll-container');
  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();
  await readContainer.evaluate((node) => {
    const container = node as HTMLDivElement;
    container.scrollTop = container.scrollHeight;
  });

  const lastReadBlock = readDocument.locator('[data-testid^="document-read-block-"]').last();
  const blockTestId = await lastReadBlock.getAttribute('data-testid');
  expect(blockTestId).toBeTruthy();
  const blockId = blockTestId!.replace('document-read-block-', '');

  await lastReadBlock.locator('[data-target-index]').nth(12).dblclick();

  await expect(page.getByRole('button', { name: 'Review mode' })).toHaveClass(/bg-blue-600/);
  const reviewBlock = page.getByTestId(`document-review-block-${blockId}`);
  await expect(reviewBlock).toBeVisible();

  await expect.poll(async () => {
    return page.getByTestId('main-document-scroll-container').evaluate((node) => {
      return (node as HTMLDivElement).scrollTop;
    });
  }).toBeGreaterThan(0);

  const reviewPosition = await Promise.all([
    page.getByTestId('main-document-scroll-container').evaluate((node) => {
      const rect = (node as HTMLDivElement).getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        scrollTop: (node as HTMLDivElement).scrollTop,
      };
    }),
    reviewBlock.evaluate((node) => {
      const rect = (node as HTMLDivElement).getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
      };
    }),
  ]);

  expect(reviewPosition[1].top).toBeGreaterThanOrEqual(reviewPosition[0].top);
  expect(reviewPosition[1].bottom).toBeLessThanOrEqual(reviewPosition[0].bottom);
});

test('sticky composer stays bounded for long input', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const shell = page.getByTestId('sticky-composer-shell');
  const preview = page.getByTestId('sticky-devanagari-preview');
  const hud = page.getByTestId('sticky-shortcut-hud');

  const longInput = Array.from({ length: 90 }, (_, index) => `agniM ile purohitaM line ${index + 1}`).join('\n');
  await textarea.fill(longInput);

  const metrics = await Promise.all([
    shell.evaluate((node) => {
      const el = node as HTMLDivElement;
      return {
        height: el.clientHeight,
        viewportHeight: window.innerHeight,
      };
    }),
    textarea.evaluate((node) => {
      const el = node as HTMLTextAreaElement;
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      };
    }),
    preview.evaluate((node) => {
      const el = node as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        bottom: rect.bottom,
      };
    }),
    hud.evaluate((node) => {
      const el = node as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      return {
        clientHeight: el.clientHeight,
        top: rect.top,
      };
    }),
  ]);

  expect(metrics[0].height).toBeLessThan(metrics[0].viewportHeight * 0.7);
  expect(metrics[1].scrollHeight).toBeGreaterThan(metrics[1].clientHeight);
  expect(metrics[2].scrollHeight).toBeGreaterThan(metrics[2].clientHeight);
  expect(metrics[3].clientHeight).toBeGreaterThan(0);
  expect(metrics[2].bottom).toBeLessThanOrEqual(metrics[3].top);
});

test('clicking devanagari preview moves the itrans caret to the mapped source position', async ({ page }) => {
  await loadDefaultSession(page);

  const sample = 'agniM ile';
  const clickedTargetIndex = 3;
  const previewMapping = transliterate(sample).targetToSourceMap;
  const expectedCaretStart = previewMapping[clickedTargetIndex];
  let expectedCaretEnd = sample.length;
  for (let index = clickedTargetIndex + 1; index < previewMapping.length; index += 1) {
    if (previewMapping[index] > expectedCaretStart) {
      expectedCaretEnd = previewMapping[index];
      break;
    }
  }
  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill(sample);
  await textarea.press('End');

  const preview = page.getByTestId('sticky-devanagari-preview');
  await expect(preview.getByTestId('preview-caret')).toBeVisible();
  await expect(preview.locator('[data-current-word="true"]').first()).toBeVisible();

  await preview.locator(`[data-target-index="${clickedTargetIndex}"]`).evaluate((node) => {
    const target = node as HTMLElement;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + 1,
      clientY: rect.top + rect.height / 2,
    }));
  });

  const selection = await textarea.evaluate((node: HTMLTextAreaElement) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
  }));

  expect(selection.start).toBe(selection.end);
  expect([expectedCaretStart, expectedCaretEnd]).toContain(selection.start);
  expect(selection.start).not.toBe(sample.length);
});

test('review composer keeps itrans and devanagari scroll positions synchronized for long text', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const preview = page.getByTestId('sticky-devanagari-preview');
  await textarea.fill(`${LONG_SNIPPET}\n${LONG_SNIPPET}`);
  await page.getByRole('button', { name: 'Review mode' }).click();
  await textarea.click();
  await textarea.press('End');

  await textarea.evaluate((node) => {
    const el = node as HTMLTextAreaElement;
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect
    .poll(async () => {
      const [sourceMetrics, previewMetrics, anchorMetrics] = await Promise.all([
        textarea.evaluate((node) => {
          const el = node as HTMLTextAreaElement;
          const range = Math.max(1, el.scrollHeight - el.clientHeight);
          return {
            scrollTop: el.scrollTop,
            progress: el.scrollTop / range,
          };
        }),
        preview.evaluate((node) => {
          const el = node as HTMLDivElement;
          const range = Math.max(1, el.scrollHeight - el.clientHeight);
          return {
            scrollTop: el.scrollTop,
            progress: el.scrollTop / range,
            textLength: el.innerText.trim().length,
          };
        }),
        preview.locator('[data-current-word="true"]').first().evaluate((node) => {
          const anchorRect = (node as HTMLElement).getBoundingClientRect();
          const containerRect = ((node as HTMLElement).closest('[data-testid="sticky-devanagari-preview"]') as HTMLElement).getBoundingClientRect();
          return {
            anchorTop: anchorRect.top,
            anchorBottom: anchorRect.bottom,
            containerTop: containerRect.top,
            containerBottom: containerRect.bottom,
          };
        }),
      ]);

      return (
        sourceMetrics.scrollTop > 0 &&
        previewMetrics.scrollTop > 0 &&
        previewMetrics.textLength > 0 &&
        Math.abs(sourceMetrics.progress - previewMetrics.progress) < 0.25 &&
        anchorMetrics.anchorTop >= anchorMetrics.containerTop + 4 &&
        anchorMetrics.anchorBottom <= anchorMetrics.containerBottom - 4
      );
    })
    .toBe(true);
});

test('display settings switch composer layout and keep composer and document typography independent', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Display' }).click();

  const shell = page.getByTestId('sticky-composer-shell');
  await expect(shell).toHaveAttribute('data-layout', 'side-by-side');

  await page.getByRole('button', { name: 'Stacked' }).click();
  await expect(shell).toHaveAttribute('data-layout', 'stacked');

  const composerInput = page.getByTestId('sticky-itrans-input');
  const preview = page.getByTestId('sticky-devanagari-preview');

  await setRangeValue(page, 'ITRANS Size', '26');
  await setRangeValue(page, 'Preview Sanskrit Size', '42');
  await setRangeValue(page, 'Document Sanskrit Size', '22');

  await composerInput.fill('agniM ile purohitaM\naayaahi viitaye');
  await page.getByRole('button', { name: 'Read mode' }).click();

  const fontSizes = await Promise.all([
    composerInput.evaluate((node) => window.getComputedStyle(node).fontSize),
    preview.evaluate((node) => window.getComputedStyle(node).fontSize),
    page.getByTestId('document-read-mode').evaluate((node) => window.getComputedStyle(node).fontSize),
  ]);

  expect(fontSizes[0]).toBe('26px');
  expect(fontSizes[1]).toBe('42px');
  expect(fontSizes[2]).toBe('22px');
});

test('prediction layout options render the suggestion tray in different positions', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Display' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');

  await page.getByRole('button', { name: 'Inline' }).click();
  await expect(page.getByTestId('word-predictions-inline')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-footer')).toHaveCount(0);

  await page.getByRole('button', { name: 'Split' }).click();
  await expect(page.getByTestId('word-predictions-split')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-inline')).toHaveCount(0);

  await page.getByRole('button', { name: 'Footer' }).click();
  await expect(page.getByTestId('word-predictions-footer')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-split')).toHaveCount(0);

  await page.getByRole('button', { name: 'Listbox' }).click();
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-footer')).toHaveCount(0);
});

test('listbox prediction mode supports arrow navigation and enter accept', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Listbox' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });

  await textarea.press('ArrowDown');
  await textarea.press('Enter');

  const value = await textarea.inputValue();
  expect(value.length).toBeGreaterThan(2);
  expect(value.startsWith('ga')).toBeTruthy();
  await expect(page.getByTestId('word-predictions-listbox')).toHaveCount(0);
});

test('floating listbox auto-hides after the configured timeout', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Listbox' }).click();
  await setRangeValue(page, 'Prediction Popup Timeout', '3');

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });

  await page.waitForTimeout(3300);
  await expect(page.getByTestId('word-predictions-listbox')).toHaveCount(0);
});

test('predictions update from the word at the active caret, not only the end of the block', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Listbox' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('agniM ile soma');
  await textarea.evaluate((node: HTMLTextAreaElement) => {
    node.focus();
    node.setSelectionRange(10, 10);
    node.dispatchEvent(new Event('select', { bubbles: true }));
  });

  await page.keyboard.type('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });
});
