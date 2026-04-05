import { test, expect } from '@playwright/test';

test.describe('Paste Normalization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sticky-itrans-input"]');
  });

  test('should swap visarga and marker in ITRANS paste when enabled', async ({ page }) => {
    // Open Workspace panel
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    // Ensure auto-swap is enabled
    // Open Workspace panel
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const toggle = page.locator('[data-testid="display-settings-toggle"]');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const checkbox = page.locator('label:has-text("Auto-Swap Markers") input');
    if (!(await checkbox.isChecked())) {
      await checkbox.click();
    }
    await page.keyboard.press('Escape'); // Close menu
    
    const input = page.locator('[data-testid="sticky-itrans-input"]');
    await input.focus();

    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', "namah' :");
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      input.dispatchEvent(event);
    });

    await page.waitForTimeout(500);
    const value = await input.inputValue();
    expect(value).toContain("nama':");
  });

  test('should swap visarga and marker in Devanagari paste when enabled', async ({ page }) => {
    // Open Workspace panel
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const toggle = page.locator('[data-testid="display-settings-toggle"]');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const checkbox = page.locator('label:has-text("Auto-Swap Markers") input');
    if (!(await checkbox.isChecked())) {
      await checkbox.click();
    }
    await page.keyboard.press('Escape');

    const input = page.locator('[data-testid="sticky-itrans-input"]');
    await input.focus();

    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', "नमः॑"); 
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      input.dispatchEvent(event);
    });

    await page.waitForTimeout(500);
    const value = await input.inputValue();
    expect(value).toContain("nama':");
  });

  test('should NOT swap when auto-swap is disabled', async ({ page }) => {
    // Open Workspace panel
    await page.click('[data-testid="workspace-toggle"]');
    await page.waitForSelector('[data-testid="workspace-sidebar"]', { state: 'visible' });

    const toggle = page.locator('[data-testid="display-settings-toggle"]');
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const checkbox = page.locator('label:has-text("Auto-Swap Markers") input');
    if (await checkbox.isChecked()) {
      await checkbox.click();
    }
    await page.keyboard.press('Escape');

    const input = page.locator('[data-testid="sticky-itrans-input"]');
    await input.focus();

    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="sticky-itrans-input"]') as HTMLTextAreaElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text', "namah' :");
      const event = new ClipboardEvent('paste', {
        clipboardData: dataTransfer,
        bubbles: true,
        cancelable: true
      });
      input.dispatchEvent(event);
    });

    await page.waitForTimeout(500);
    const value = await input.inputValue();
    expect(value).toContain("namah' :");
  });
});
