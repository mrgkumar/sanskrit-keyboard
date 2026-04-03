import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];
const VEDIC_PASTE_SAMPLE = 'भ॒द्रं कर्णे॑भिः शृणु॒याम॑ देवाः ।';

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
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByTestId('sticky-itrans-input')).toHaveValue('');
};

const openDisplaySettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.locator('button').filter({ hasText: /^Display$/ }).click();
};

const closeWorkspace = async (page: Page) => {
  await page.getByRole('button', { name: /workspace/i }).click();
};

test('inspect lexical autocomplete keyboard flow and block delete flows', async ({ page }) => {
  await loadDefaultSession(page);
  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Footer' }).click();
  await closeWorkspace(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.type('sa', { delay: 80 });

  const lexicalSection = page.getByTestId('word-predictions-footer');
  await expect(lexicalSection).toBeVisible({ timeout: 10000 });
  await expect(lexicalSection).toContainText('Word Predictions');
  await expect(lexicalSection).toContainText('Cycle');
  await expect(lexicalSection).toContainText('Accept');

  const topSuggestion = page.getByTestId('lexical-suggestion-footer-0');
  const secondSuggestion = page.getByTestId('lexical-suggestion-footer-1');
  await expect(topSuggestion).toBeVisible();
  await expect(secondSuggestion).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(secondSuggestion).toContainText('Selected');

  const expectedItrans = ((await secondSuggestion.innerText()).split('\n').find((line) => /^sa/i.test(line.trim())) ?? '').trim();
  await page.keyboard.press('Enter');
  await expect(textarea).toHaveValue(expectedItrans);

  const firstDeleteButton = page.getByTitle('Delete block').first();
  await expect(firstDeleteButton).toBeVisible();
  await firstDeleteButton.click();

  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.getByRole('button', { name: /undo delete/i }).click();
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});

test('single-line Devanagari paste feeds session-local lexical prediction', async ({ page }) => {
  await loadDefaultSession(page);
  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Footer' }).click();
  await closeWorkspace(page);

  const textarea = page.getByTestId('sticky-itrans-input');
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
  await page.keyboard.type('karN', { delay: 80 });

  await expect(page.getByTestId('word-predictions-footer')).toContainText("karNe'bhi");

  await openDisplaySettings(page);
  await page.getByTestId('swara-prediction-toggle').uncheck();
  await closeWorkspace(page);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('karN', { delay: 80 });
  await expect(page.getByTestId('word-predictions-footer')).toContainText('karNebhi');

  await openDisplaySettings(page);
  await page.getByTestId('swara-prediction-toggle').check();
  await closeWorkspace(page);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('karN', { delay: 80 });
  await expect(page.getByTestId('word-predictions-footer')).toContainText("karNe'bhi");
});

test('can purge current-session and saved swara learning separately', async ({ page }) => {
  await loadDefaultSession(page);
  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Footer' }).click();
  await closeWorkspace(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const learnedToken = "gaNeshkumaar'";
  await textarea.click();
  await page.keyboard.type(`${learnedToken} `, { delay: 60 });

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('gaNe', { delay: 80 });

  await expect(page.getByTestId('word-predictions-footer')).toContainText(learnedToken);

  await openDisplaySettings(page);
  await page.getByTestId('clear-session-learning').click();
  await closeWorkspace(page);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('gaNe', { delay: 80 });
  await expect(page.getByTestId('word-predictions-footer')).toContainText(learnedToken);

  await openDisplaySettings(page);
  await page.getByTestId('purge-saved-learning').click();
  await closeWorkspace(page);

  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('gaNe', { delay: 80 });
  await expect(page.getByTestId('word-predictions-footer')).not.toContainText(learnedToken);
});
