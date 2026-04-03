import { expect, test, type Page } from '@playwright/test';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

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
  }, STORAGE_KEYS_TO_CLEAR);
  await page.goto(APP_URL);
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByTestId('sticky-itrans-input')).toHaveValue('');
};

const clearTextarea = async (page: Page) => {
  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await expect(textarea).toHaveValue('');
};

const setReadAs = async (page: Page, script: 'roman' | 'devanagari' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

test('alias input stays raw while typing and canonicalizes on commit', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();

  await page.keyboard.type('Ru', { delay: 40 });
  await expect(textarea).toHaveValue('Ru');

  await page.keyboard.type(' ', { delay: 40 });
  await expect(textarea).toHaveValue('R^i ');

  await clearTextarea(page);

  await page.keyboard.type('&tman', { delay: 40 });
  await expect(textarea).toHaveValue('&tman');

  await page.keyboard.type(' ', { delay: 40 });
  await expect(textarea).toHaveValue('.atman ');
});

test('session-learned predictions from alias input display and insert canonical forms', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.type('Kavi ', { delay: 40 });
  await expect(textarea).toHaveValue('khavi ');

  await clearTextarea(page);

  await page.keyboard.type('Ka', { delay: 60 });

  const lexicalSection = page.getByTestId('word-predictions-footer');
  await expect(lexicalSection).toBeVisible({ timeout: 10000 });
  await expect(lexicalSection).toContainText('khavi');
  await expect(lexicalSection).not.toContainText('Kavi');

  await lexicalSection.getByRole('button', { name: /khavi/i }).click();
  await expect(textarea).toHaveValue('khavi');
});

test('settings mappings show alternate accepted inputs as secondary hints', async ({ page }) => {
  await page.goto(`${APP_URL}/settings/mappings`);

  await expect(page.getByText('Keyboard Customization')).toBeVisible();
  await expect(page.getByText('Also accepts K')).toBeVisible();
  await expect(page.getByText(/^Also accepts Ru$/)).toBeVisible();
});

test('true-conflict aliases stay gated until Baraha-compatible mode is enabled', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.type('c ', { delay: 40 });
  await expect(textarea).toHaveValue('c ');

  await clearTextarea(page);
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByTestId('input-scheme-baraha').click();
  await page.getByRole('button', { name: 'Workspace' }).click();
  await setReadAs(page, 'devanagari');

  await textarea.click();
  await page.keyboard.type('c', { delay: 40 });
  await expect(textarea).toHaveValue('c');
  await expect(page.getByTestId('sticky-preview-primary-pane')).toContainText('च');

  await page.keyboard.type(' ', { delay: 40 });
  await expect(textarea).toHaveValue('ch ');
});

test('source copy follows the explicit output style without changing stored source', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.type('R^i kh ch OM .a', { delay: 40 });
  await expect(textarea).toHaveValue('R^i kh ch OM .a');

  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByTestId('workspace-roman-style-baraha').click();
  await expect(page.getByTestId('copy-whole-source')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace' }).click();

  await expect(page.getByTestId('copy-source-button')).toHaveAttribute('aria-label', /Roman \(Baraha\)/);
  await page.getByTestId('copy-source-button').click();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe('Ru K c oum &');
  await expect(textarea).toHaveValue('R^i kh ch OM .a');
});
