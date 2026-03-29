import { expect, test } from '@playwright/test';

test('inspect lexical autocomplete and block delete flows', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  await page.keyboard.type('sa', { delay: 80 });

  const lexicalSection = page.getByTestId('lexical-suggestions');
  await expect(lexicalSection).toBeVisible({ timeout: 10000 });
  await expect(lexicalSection).toContainText('Word Predictions');
  await expect(lexicalSection).toContainText('Top suggestion');

  const topSuggestion = page.getByTestId('lexical-suggestion-0');
  await expect(topSuggestion).toBeVisible();
  const expectedItrans = ((await topSuggestion.innerText()).split('\n').find((line) => /^sa/i.test(line.trim())) ?? '').trim();
  console.log(`Top lexical suggestion: ${expectedItrans}`);

  await page.keyboard.press('Tab');
  await expect(textarea).toHaveValue(expectedItrans);

  const firstDeleteButton = page.getByTitle('Delete block').first();
  await expect(firstDeleteButton).toBeVisible();
  await firstDeleteButton.click();

  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.getByRole('button', { name: /undo delete/i }).click();
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});
