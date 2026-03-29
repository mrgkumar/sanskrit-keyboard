import { expect, test, type Page } from '@playwright/test';

const APP_URL = 'http://localhost:3000';
const STORAGE_KEY = 'sanskrit-keyboard.sessions.v1';

const loadDefaultSession = async (page: Page) => {
  await page.goto(APP_URL);
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('textarea')).toBeVisible();
};

test('delete toast auto-dismisses after a short timeout', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTitle('Delete block').first().click();
  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.waitForTimeout(5600);
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});

test('backspace correction replaces the intended suffix', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.locator('textarea');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('prri');
  await page.keyboard.press('Backspace');

  await expect(page.getByText('Correction Help')).toBeVisible();
  await page.locator('button').filter({ has: page.getByText('RRi') }).first().click();
  await expect(textarea).toHaveValue('pRRi');
});

test('clicking a correction keeps the caret at the replacement point', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.locator('textarea');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('rri');
  await page.keyboard.press('Backspace');

  const correctionButton = page.locator('button').filter({ has: page.getByText('RRi') }).first();
  await correctionButton.click();

  await expect(textarea).toHaveValue('RRi');
  const selectionStart = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart);
  const selectionEnd = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionEnd);
  expect(selectionStart).toBe(3);
  expect(selectionEnd).toBe(3);
});

test('focus read and review modes visibly change the document view', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Review' }).click();
  await expect(page.getByText('ITRANS Source').first()).toBeVisible();

  await page.getByRole('button', { name: 'Read' }).click();
  await expect(page.getByText('ITRANS Source')).toHaveCount(0);
  await expect(page.getByText('Focused Source')).toHaveCount(0);

  await page.getByRole('button', { name: 'Focus' }).click();
  await expect(page.getByText('Focused Source').first()).toBeVisible();
});
