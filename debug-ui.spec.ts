import { expect, test } from '@playwright/test';

test('Deep UI Inspection - Sanskirt Keyboard', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const input = page.getByTestId('sticky-itrans-input');
  const preview = page.getByTestId('sticky-devanagari-preview');

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
