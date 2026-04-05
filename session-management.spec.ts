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
    // 1. Open Workspace panel
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    // 2. Create a specific session name to search for
    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const uniqueName = `UniqueSession-${Date.now()}`;
    await sessionInput.fill(uniqueName);
    
    // Trigger save to ensure it's in the list
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000); // Wait for save/index update

    // 3. Search for it
    const searchInput = page.locator('input[placeholder="Search sessions..."]');
    await searchInput.fill('UniqueSession');

    // 4. Verify it's visible
    const sessionItem = page.locator(`button:has-text("${uniqueName}")`);
    await expect(sessionItem).toBeVisible();

    // 5. Search for something non-existent
    await searchInput.fill('NonExistentSessionXYZ');
    await expect(sessionItem).not.toBeVisible();
  });

  test('should be able to rename a session', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const initialName = `ToRename-${Date.now()}`;
    await sessionInput.fill(initialName);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Find the session item and click rename 
    const sessionGroup = page.locator(`div.group:has-text("${initialName}")`);
    const renameButton = sessionGroup.locator('button[title="Rename session"]');
    await renameButton.click({ force: true });

    // Wait for the input to appear and target it specifically
    const renameInput = page.locator('[data-testid="session-rename-input"]');
    await renameInput.waitFor({ state: 'visible' });

    const newName = `Renamed-${Date.now()}`;
    await renameInput.fill(newName);
    await page.keyboard.press('Enter');

    // Verify change
    await page.waitForTimeout(500);
    await expect(page.locator(`button:has-text("${newName}")`)).toBeVisible();
    await expect(page.locator(`button:has-text("${initialName}")`)).not.toBeVisible();
  });

  test('should persist a saved session across reloads', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const persistedName = `Persisted-${Date.now()}`;
    await sessionInput.fill(persistedName);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForSelector('[data-testid="sticky-itrans-input"]');

    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    await expect(page.locator('input[placeholder="Active session name..."]')).toHaveValue(persistedName);
    await expect(page.locator(`button:has-text("${persistedName}")`)).toBeVisible();
  });

  test('should be able to delete a session', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const sessionInput = page.locator('input[placeholder="Active session name..."]');
    const toDeleteName = `ToDelete-${Date.now()}`;
    await sessionInput.fill(toDeleteName);
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(1000);

    // Verify it exists first
    await expect(page.locator(`button:has-text("${toDeleteName}")`)).toBeVisible();

    // Delete it
    const sessionGroup = page.locator(`div.group:has-text("${toDeleteName}")`);
    
    // Setup dialog handler for confirmation
    page.once('dialog', dialog => dialog.accept());
    await sessionGroup.locator('button[title="Delete session"]').click({ force: true });

    // Verify it's gone
    await page.waitForTimeout(500);
    await expect(page.locator(`button:has-text("${toDeleteName}")`)).not.toBeVisible();
  });
});
