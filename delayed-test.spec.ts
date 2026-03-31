import { expect, test } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils';

test('Scholarly Source-of-Truth Workflow Test', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const input = page.getByTestId('sticky-itrans-input');
  const preview = page.getByTestId('sticky-devanagari-preview');

  await expect(input).toBeVisible();
  await input.focus();

  const sample = 'a_gni';
  await page.keyboard.type(sample, { delay: 120 });

  await expect(preview).toContainText(transliterate(sample).unicode);

  await page.keyboard.press('ArrowLeft', { delay: 100 });
  await page.keyboard.press('ArrowLeft', { delay: 100 });
  await page.keyboard.type("'", { delay: 120 });

  await expect(preview).toContainText('\u0951');
});
