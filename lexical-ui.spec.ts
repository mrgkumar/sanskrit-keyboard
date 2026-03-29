import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';
const VEDIC_PASTE_SAMPLE = 'भ॒द्रं कर्णे॑भिः शृणु॒याम॑ देवाः ।';

test('inspect lexical autocomplete keyboard flow and block delete flows', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  await page.keyboard.type('sa', { delay: 80 });

  const lexicalSection = page.getByTestId('lexical-suggestions');
  await expect(lexicalSection).toBeVisible({ timeout: 10000 });
  await expect(lexicalSection).toContainText('Word Predictions');
  await expect(lexicalSection).toContainText('Cycle');
  await expect(lexicalSection).toContainText('Accept');

  const topSuggestion = page.getByTestId('lexical-suggestion-0');
  const secondSuggestion = page.getByTestId('lexical-suggestion-1');
  await expect(topSuggestion).toBeVisible();
  await expect(secondSuggestion).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(secondSuggestion).toContainText('Selected');

  const expectedItrans = ((await secondSuggestion.innerText()).split('\n').find((line) => /^sa/i.test(line.trim())) ?? '').trim();
  console.log(`Selected lexical suggestion after Tab: ${expectedItrans}`);

  await page.keyboard.press('Enter');
  await expect(textarea).toHaveValue(expectedItrans);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('sa', { delay: 80 });

  await expect(page.getByTestId('lexical-suggestion-0')).toContainText(expectedItrans);

  const firstDeleteButton = page.getByTitle('Delete block').first();
  await expect(firstDeleteButton).toBeVisible();
  await firstDeleteButton.click();

  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.getByRole('button', { name: /undo delete/i }).click();
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});

test('single-line Devanagari paste feeds session-local lexical prediction', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.evaluate((key) => {
    window.localStorage.removeItem(key);
    window.localStorage.removeItem('sanskrit-keyboard.lexical-history.v1');
  }, STORAGE_KEY);
  await page.reload();

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');

  await textarea.evaluate((node, pastedText) => {
    const event = new Event('paste', { bubbles: true, cancelable: true }) as Event & {
      clipboardData: { getData: (type: string) => string };
    };
    event.clipboardData = {
      getData: (type: string) => (type === 'text' ? pastedText : ''),
    };
    node.dispatchEvent(event);
  }, VEDIC_PASTE_SAMPLE);

  await expect(textarea).toHaveValue(/bha.?draM/);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('bha', { delay: 80 });

  await expect(page.getByTestId('lexical-suggestion-0')).toContainText('bha_draM');

  await page.getByRole('button', { name: /workspace/i }).click();
  await page.getByTestId('swara-prediction-toggle').uncheck();
  await page.getByRole('button', { name: /workspace/i }).click();

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('bha', { delay: 80 });
  await expect(page.getByTestId('lexical-suggestion-0')).toContainText('bhadraM');

  await page.getByRole('button', { name: /workspace/i }).click();
  await page.getByTestId('swara-prediction-toggle').check();
  await page.getByRole('button', { name: /workspace/i }).click();

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('bha', { delay: 80 });
  await expect(page.getByTestId('lexical-suggestion-0')).toContainText('bha_draM');
});

test('can purge current-session and saved swara learning separately', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    window.localStorage.removeItem('sanskrit-keyboard.sessions.v1');
    window.localStorage.removeItem('sanskrit-keyboard.lexical-history.v1');
  });
  await page.reload();

  const textarea = page.locator('textarea');
  await expect(textarea).toBeVisible();
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type("a'gni ", { delay: 60 });

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('ag', { delay: 80 });

  await expect(page.getByTestId('lexical-suggestion-0')).toContainText("a'gni");

  await page.getByRole('button', { name: /workspace/i }).click();
  await page.getByTestId('clear-session-learning').click();
  await page.getByRole('button', { name: /workspace/i }).click();

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('ag', { delay: 80 });
  await expect(page.getByTestId('lexical-suggestion-0')).toContainText("a'gni");

  await page.getByRole('button', { name: /workspace/i }).click();
  await page.getByTestId('purge-saved-learning').click();
  await page.getByRole('button', { name: /workspace/i }).click();

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('ag', { delay: 80 });
  await expect(page.getByTestId('lexical-suggestion-0')).not.toContainText("a'gni");
});
