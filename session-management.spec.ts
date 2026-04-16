import { test, expect } from '@playwright/test';

const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

test.describe('Session Management', () => {
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

    await page.goto('/');
    await page.waitForSelector('[data-testid="sticky-itrans-input"]');
  });

  test('should be able to search for a session', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-sessions"]');

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const uniqueName = `UniqueSession-${Date.now()}`;
    await sessionInput.fill(uniqueName);
    await page.getByRole('button', { name: 'Save Now' }).click();

    const searchInput = page.locator('input[placeholder="Search saved work..."]');
    await searchInput.fill('UniqueSession');

    const sessionItem = page.locator(`button:has-text("${uniqueName}")`);
    await expect(sessionItem).toBeVisible();

    await searchInput.fill('NonExistentSessionXYZ');
    await expect(sessionItem).not.toBeVisible();
  });

  test('should be able to rename a session', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-sessions"]');

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const initialName = `ToRename-${Date.now()}`;
    await sessionInput.fill(initialName);
    await page.getByRole('button', { name: 'Save Now' }).click();

    const sessionGroup = page.locator(`div.group:has-text("${initialName}")`);
    await sessionGroup.getByTitle('Rename').click({ force: true });

    const renameInput = sessionGroup.locator('input');
    await renameInput.waitFor({ state: 'visible' });

    const newName = `Renamed-${Date.now()}`;
    await renameInput.fill(newName);
    await page.keyboard.press('Enter');

    await expect(page.locator(`button:has-text("${newName}")`)).toBeVisible();
    await expect(page.locator(`button:has-text("${initialName}")`)).not.toBeVisible();
  });

  test('should persist a saved session across reloads', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-sessions"]');

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const persistedName = `Persisted-${Date.now()}`;
    await sessionInput.fill(persistedName);
    await page.getByRole('button', { name: 'Save Now' }).click();

    await page.reload();
    await page.waitForSelector('[data-testid="sticky-itrans-input"]');

    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-sessions"]');

    await expect(page.locator('input[placeholder="Active session name..."]')).toHaveValue(persistedName);
    await expect(page.locator(`button:has-text("${persistedName}")`)).toBeVisible();
  });

  test('should be able to delete a session', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-sessions"]');

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const toDeleteName = `ToDelete-${Date.now()}`;
    await sessionInput.fill(toDeleteName);
    await page.getByRole('button', { name: 'Save Now' }).click();

    await expect(page.locator(`button:has-text("${toDeleteName}")`)).toBeVisible();

    const sessionGroup = page.locator(`div.group:has-text("${toDeleteName}")`);
    page.once('dialog', (dialog) => dialog.accept());
    await sessionGroup.getByTitle('Delete').click({ force: true });

    await expect(page.locator(`button:has-text("${toDeleteName}")`)).not.toBeVisible();
  });
});
