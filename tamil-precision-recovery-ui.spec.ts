import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

const clearStorage = async (page: Page) => {
  await page.addInitScript((keys) => {
    window.localStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sanskrit-keyboard.session.v2.'))
      .forEach((key) => window.localStorage.removeItem(key));
  }, STORAGE_KEYS_TO_CLEAR);
};

const loadDefaultSession = async (page: Page) => {
  await clearStorage(page);
  await page.goto(APP_URL);
  page.on('dialog', (dialog) => dialog.accept());
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
};

const openWorkspace = async (page: Page) => {
  await page.getByRole('button', { name: 'Workspace' }).click();
  await expect(page.getByTestId('workspace-tamil-precision-recovery')).toBeVisible();
};

test('Tamil Precision Recovery stays explicitly bounded in the workspace panel', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  const recoverySection = page.getByTestId('workspace-tamil-precision-recovery');
  await expect(recoverySection).toContainText('Tamil Precision Recovery');
  await expect(recoverySection).toContainText('Utility');
  await expect(recoverySection).toContainText(
    'Phase 1 utility: recovers Roman Sanskrit only from frozen Tamil Precision input. Plain Tamil and Baraha Tamil reject instead of guessing.',
  );
  await expect(page.getByTestId('tamil-recovery-empty')).toContainText(
    'Paste Tamil Precision text here to recover canonical Roman and derived Baraha Roman safely.',
  );
});

test('Tamil Precision Recovery shows canonical and Baraha Roman outputs for exact input', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await page.getByTestId('tamil-recovery-input').fill('க³ீதா');

  await expect(page.getByTestId('tamil-recovery-success')).toContainText(
    'Exact recovery succeeded from Tamil Precision input.',
  );
  await expect(page.getByTestId('tamil-recovery-canonical-output')).toContainText('gItA');
  await expect(page.getByText('Derived Baraha Roman')).toBeVisible();
  await expect(page.getByTestId('tamil-recovery-baraha-output')).toContainText('gItA');
  await expect(page.getByText('Derived from the canonical recovery result. It is not a separate Tamil parser mode.')).toBeVisible();
});

test('Tamil Precision Recovery rejects plain Tamil without inventing a Roman answer', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await page.getByTestId('tamil-recovery-input').fill('குரு');

  const rejection = page.getByTestId('tamil-recovery-rejection');
  await expect(rejection).toContainText('Rejected: plain-tamil');
  await expect(rejection).toContainText(
    'Input is Tamil script but does not contain the frozen Tamil Precision distinctions required for exact Sanskrit recovery.',
  );
  await expect(page.getByTestId('tamil-recovery-rejected-source')).toContainText('குரு');
  await expect(page.getByTestId('tamil-recovery-success')).toHaveCount(0);
});

test('Tamil Precision Recovery clears success outputs when input transitions from valid precision to rejected text', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  const input = page.getByTestId('tamil-recovery-input');
  await input.fill('க³ீதா');
  await expect(page.getByTestId('tamil-recovery-success')).toBeVisible();
  await expect(page.getByTestId('tamil-recovery-canonical-output')).toContainText('gItA');

  await input.fill('ஸ்ரீ^^');

  const rejection = page.getByTestId('tamil-recovery-rejection');
  await expect(rejection).toContainText('Rejected: baraha-tamil');
  await expect(page.getByTestId('tamil-recovery-success')).toHaveCount(0);
  await expect(page.getByTestId('tamil-recovery-canonical-output')).toHaveCount(0);
  await expect(page.getByTestId('tamil-recovery-baraha-output')).toHaveCount(0);
});
