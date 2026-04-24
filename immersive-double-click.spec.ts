import { expect, test, type Page } from '@playwright/test';

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

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click();
};

test('immersive double click scrolls the chosen line into read mode and places the composer caret on the clicked word', async ({ page }) => {
  await loadDefaultSession(page);

  const lines = Array.from({ length: 100 }, (_, index) => `agniM beta gamma ${index + 1}`);
  await page.getByTestId('sticky-itrans-input').fill(lines.join('\n'));
  await setReadAs(page, 'devanagari');

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();

  const lastImmersiveBlock = page.locator('[data-testid^="document-immersive-block-"]').last();
  await lastImmersiveBlock.scrollIntoViewIfNeeded();
  const blockTestId = await lastImmersiveBlock.getAttribute('data-testid');
  if (!blockTestId) {
    throw new Error('Expected the last immersive block to have a data-testid');
  }

  const betaWord = lastImmersiveBlock.locator('[data-source-start]').nth(1);
  const betaStart = Number(await betaWord.getAttribute('data-source-start'));
  const betaEnd = Number(await betaWord.getAttribute('data-source-end'));
  if (Number.isNaN(betaStart)) {
    throw new Error('Expected a numeric source start for the clicked word');
  }
  if (Number.isNaN(betaEnd)) {
    throw new Error('Expected a numeric source end for the clicked word');
  }

  await betaWord.dblclick();

  await expect(page.getByTestId('document-read-mode')).toBeVisible();
  await expect(page.getByTestId(`document-read-block-${blockTestId.replace('document-immersive-block-', '')}`)).toBeInViewport();

  const selectionStart = await page.getByTestId('sticky-itrans-input').evaluate((node: HTMLTextAreaElement) => node.selectionStart);
  expect(selectionStart).toBeGreaterThanOrEqual(betaStart);
  expect(selectionStart).toBeLessThanOrEqual(betaEnd);
});
