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

const openImmersiveFind = async (page: Page) => {
  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();
  await page.keyboard.press('Control+f');
  await expect(page.getByTestId('immersive-find-overlay')).toBeVisible();
  await expect(page.getByTestId('immersive-find-input')).toBeFocused();
};

test('immersive replace current updates the current rendered word', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM agniM agniM');
  await setReadAs(page, 'devanagari');
  await openImmersiveFind(page);

  await page.getByTestId('immersive-find-input').fill('agniM');
  await expect(page.getByTestId('immersive-find-counter')).toContainText('1 /');
  await page.getByRole('button', { name: 'Show replace field' }).click();
  await page.getByTestId('immersive-replace-input').fill('somaM');
  await expect(page.getByTestId('immersive-replace-preview')).toContainText('सोम');

  await page.getByRole('button', { name: 'Replace current match' }).click();

  const replacedCount = await page
    .locator('[data-testid="document-immersive-mode"] [data-word-key]')
    .evaluateAll((nodes) => nodes.filter((node) => node.textContent?.includes('सोमं')).length);
  expect(replacedCount).toBe(1);
});

test('immersive replace all updates every rendered match', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM agniM agniM');
  await setReadAs(page, 'devanagari');
  await openImmersiveFind(page);

  await page.getByTestId('immersive-find-input').fill('agniM');
  await page.getByRole('button', { name: 'Show replace field' }).click();
  await page.getByTestId('immersive-replace-input').fill('somaM');
  await page.getByRole('button', { name: 'Replace all matches' }).click();

  const replacedCount = await page
    .locator('[data-testid="document-immersive-mode"] [data-word-key]')
    .evaluateAll((nodes) => nodes.filter((node) => node.textContent?.includes('सोमं')).length);
  expect(replacedCount).toBe(3);
  await expect(page.getByTestId('immersive-find-counter')).toHaveText('No matches');
});
