import { expect, test, type Page } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

test('Scholarly Source-of-Truth Workflow Test', async ({ page }) => {
  await page.goto(APP_URL);

  const input = page.getByTestId('sticky-itrans-input');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');

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
