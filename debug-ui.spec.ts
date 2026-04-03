import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

test('Deep UI Inspection - Sanskirt Keyboard', async ({ page }) => {
  await page.goto(APP_URL);

  const input = page.getByTestId('sticky-itrans-input');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');

  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('bha_dra', { delay: 80 });

  await expect(preview).toBeVisible();
  await expect(preview).not.toHaveText('');

  await page.getByRole('button', { name: /workspace/i }).click();
  await page.getByRole('button', { name: 'Display' }).click();
  await page.getByRole('button', { name: 'Listbox' }).click();
  await page.getByRole('button', { name: /workspace/i }).click();

  await page.keyboard.type(' kSh', { delay: 80 });

  const suggestionList = page.getByTestId('word-predictions-listbox');
  await expect(suggestionList).toBeVisible({ timeout: 10000 });
  await expect(suggestionList).toContainText('Word Predictions');
});
