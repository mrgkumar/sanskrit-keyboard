import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { detransliterate } from './src/lib/vedic/utils.ts';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const SESSION_INDEX_KEY = 'sanskrit-keyboard.session-index.v2';
const SESSION_SNAPSHOT_PREFIX = 'sanskrit-keyboard.session.v2.';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  SESSION_INDEX_KEY,
  'sanskrit-keyboard.lexical-history.v1',
];

const rawArchiveSample = fs
  .readFileSync(path.join(process.cwd(), '../archive/example.txt'), 'utf8')
  .split(/\r?\n/)
  .slice(0, 20)
  .join('\n');

const itransArchiveSample = detransliterate(rawArchiveSample);

const readSavedBlocks = async (page: Page) =>
  page.evaluate(
    ({ sessionIndexKey, snapshotPrefix }) => {
      const sessionIndex = JSON.parse(window.localStorage.getItem(sessionIndexKey) ?? '[]') as Array<{ sessionId: string }>;
      const activeSessionId = sessionIndex[0]?.sessionId;
      if (!activeSessionId) {
        return [];
      }

      const snapshot = JSON.parse(
        window.localStorage.getItem(`${snapshotPrefix}${activeSessionId}`) ?? '{"blocks":[]}'
      ) as { blocks: Array<{ source: string }> };

      return snapshot.blocks.map((block) => block.source);
    },
    { sessionIndexKey: SESSION_INDEX_KEY, snapshotPrefix: SESSION_SNAPSHOT_PREFIX }
  );

const resetToBlankSession = async (page: Page) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(APP_URL);
  await expect(page.locator('textarea')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.locator('textarea')).toHaveValue('');
};

const expectArchiveSampleToStayStable = async (
  page: Page,
  mode: 'insert' | 'type'
) => {
  await resetToBlankSession(page);

  const textarea = page.locator('textarea');
  await textarea.click();

  if (mode === 'insert') {
    await page.keyboard.insertText(itransArchiveSample);
  } else {
    await page.keyboard.type(itransArchiveSample, { delay: 0 });
  }

  await page.waitForTimeout(1200);

  const savedBlocks = await readSavedBlocks(page);
  expect(savedBlocks.join('\n\n')).toBe(itransArchiveSample);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript((keys) => {
    window.localStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sanskrit-keyboard.session.v2.'))
      .forEach((key) => window.localStorage.removeItem(key));
  }, STORAGE_KEYS_TO_CLEAR);
});

test.setTimeout(180000);

test('inserting the archive sample keeps the document text stable without repetition', async ({ page }) => {
  await expectArchiveSampleToStayStable(page, 'insert');
});

test('typing the archive sample key by key keeps the document text stable without repetition', async ({ page }) => {
  await expectArchiveSampleToStayStable(page, 'type');
});
