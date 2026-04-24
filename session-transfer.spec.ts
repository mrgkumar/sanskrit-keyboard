import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs/promises';

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

const openSessionsTab = async (page: Page) => {
  await page.getByTestId('workspace-toggle').click();
  await page.getByTestId('workspace-tab-sessions').click();
};

const waitForExportDownload = async (page: Page, action: () => Promise<void>) => {
  const downloadPromise = page.waitForEvent('download');
  await action();
  return downloadPromise;
};

test('export and import a session snapshot round-trips the current workspace', async ({ page }) => {
  await loadDefaultSession(page);
  await openSessionsTab(page);

  const uniqueName = `Portable-${Date.now()}`;
  const sessionNameInput = page.locator('input[placeholder="Active session name..."]');
  await sessionNameInput.fill(uniqueName);
  await page.getByRole('button', { name: 'Save Now' }).click();

  const download = await waitForExportDownload(page, async () => {
    await page.getByRole('button', { name: 'Export Session' }).click();
  });

  expect(download.suggestedFilename()).toContain('sanskrit-keyboard-');
  const exportPath = `/tmp/session-transfer-${Date.now()}.json`;
  await download.saveAs(exportPath);

  const exported = JSON.parse(await fs.readFile(exportPath, 'utf8')) as {
    kind: string;
    schemaVersion: number;
    session: { sessionId: string; sessionName: string; blocks: unknown[] };
    lexicalLearning: { version: number };
  };

  expect(exported.kind).toBe('sanskrit-keyboard-session-export');
  expect(exported.schemaVersion).toBe(1);
  expect(exported.session.sessionName).toBe(uniqueName);
  const exportedSessionId = exported.session.sessionId;
  expect(exported.session.blocks.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'New Blank' }).click();

  await openSessionsTab(page);
  await page.getByTestId('session-import-input').setInputFiles(exportPath);

  await openSessionsTab(page);
  await expect(page.locator('input[placeholder="Active session name..."]')).toHaveValue(uniqueName);
  await expect(page.locator(`button:has-text("${uniqueName}")`)).toBeVisible();

  const storedSnapshot = await page.evaluate((sessionId) => window.localStorage.getItem(`sanskrit-keyboard.session.v2.${sessionId}`), exportedSessionId);
  expect(storedSnapshot).not.toBeNull();
  const parsedStoredSnapshot = JSON.parse(storedSnapshot as string) as { sessionName: string };
  expect(parsedStoredSnapshot.sessionName).toBe(uniqueName);
});
