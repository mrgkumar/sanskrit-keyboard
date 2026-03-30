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
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      };
    }),
    hud.evaluate((node) => {
      const el = node as HTMLDivElement;
      return {
        clientHeight: el.clientHeight,
      };
    }),
  ]);

  expect(metrics[0].height).toBeLessThan(metrics[0].viewportHeight * 0.7);
  expect(metrics[1].scrollHeight).toBeGreaterThan(metrics[1].clientHeight);
  expect(metrics[2].scrollHeight).toBeGreaterThan(metrics[2].clientHeight);
  expect(metrics[3].clientHeight).toBeGreaterThan(0);
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
