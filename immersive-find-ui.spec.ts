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

test('immersive find opens with Ctrl+F, previews transliteration, and advances matches', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM agniM');
  await setReadAs(page, 'devanagari');

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();

  await page.keyboard.press('Control+f');
  const overlay = page.getByTestId('immersive-find-overlay');
  const input = page.getByTestId('immersive-find-input');
  await expect(overlay).toBeVisible();
  await expect(input).toBeFocused();

  await input.fill('agni');

  await expect(page.getByTestId('immersive-find-preview')).toContainText('अग्नि');
  await expect(page.getByTestId('immersive-find-counter')).not.toHaveText('No matches');
  await expect(page.getByTestId('immersive-find-counter')).toContainText('1 /');

  const highlightedCount = await page.locator('[data-immersive-find-word-key]').evaluateAll((nodes) =>
    nodes.filter((node) => node.className.includes('bg-amber-200/70')).length
  );
  expect(highlightedCount).toBeGreaterThan(0);

  await input.press('Enter');
  await expect(page.getByTestId('immersive-find-counter')).toContainText('2 /');
});
