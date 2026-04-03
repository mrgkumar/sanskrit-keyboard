import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

const longSnippet = readFileSync(join(__dirname, '..', 'archive', 'long_snippet.txt'), 'utf8').trim();

const viewports = [
  { name: 'min-desktop', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop-wide', width: 1440, height: 900 },
  { name: 'large-desktop', width: 1600, height: 900 },
  { name: 'max-desktop', width: 1920, height: 1080 },
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
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
  page.removeAllListeners('dialog');
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByTestId('sticky-itrans-input')).toHaveValue('');
};

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

test('inspect long snippet across responsive viewports', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await loadDefaultSession(page);

    const textarea = page.getByTestId('sticky-itrans-input');
    await textarea.fill(longSnippet);
    await setReadAs(page, 'devanagari');

    await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
    await expect(page.getByTestId('sticky-preview-primary-pane')).toBeVisible();

    console.log(`INSPECT viewport=${viewport.name} size=${viewport.width}x${viewport.height}`);
    await page.waitForTimeout(3000);
  }
});
