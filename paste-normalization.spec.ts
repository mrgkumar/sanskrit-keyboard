import { test, expect } from '@playwright/test';

test.describe('Paste Normalization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="sticky-itrans-input"]');
  });

  test('should swap visarga and marker in ITRANS paste when enabled', async ({ page }) => {
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-intelligence"]');

    const checkbox = page.locator('label').filter({ hasText: 'Auto-Swap Markers' }).locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check({ force: true });
    }
    await page.click('[data-testid="workspace-toggle"]');
    
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
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-intelligence"]');

    const checkbox = page.locator('label').filter({ hasText: 'Auto-Swap Markers' }).locator('input[type="checkbox"]');
    if (!(await checkbox.isChecked())) {
      await checkbox.check({ force: true });
    }
    await page.click('[data-testid="workspace-toggle"]');

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
    await page.click('[data-testid="workspace-toggle"]');
    await page.click('[data-testid="workspace-tab-intelligence"]');

    const checkbox = page.locator('label').filter({ hasText: 'Auto-Swap Markers' }).locator('input[type="checkbox"]');
    if (await checkbox.isChecked()) {
      await checkbox.uncheck({ force: true });
    }
    await page.click('[data-testid="workspace-toggle"]');

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
