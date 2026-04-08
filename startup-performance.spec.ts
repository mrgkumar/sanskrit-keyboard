import { test, expect } from '@playwright/test';

test.describe('Startup Performance', () => {
  test('should show skeleton loader during initial load', async ({ page }) => {
    // We navigate to the home page
    await page.goto('/');

    // Check if the skeleton loader is present
    const skeleton = page.locator('.animate-pulse');
    await expect(skeleton).toBeVisible();

    // Eventually the main engine should load
    const composer = page.locator('textarea');
    await expect(composer).toBeVisible({ timeout: 15000 });
    
    // Skeleton should be gone
    await expect(skeleton).not.toBeVisible();
  });

  test('should load without blocking main thread excessively', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    
    // Measure time to first interactive (approximation)
    await page.waitForSelector('textarea');
    const loadTime = Date.now() - startTime;
    
    console.log(`App became interactive in ${loadTime}ms`);
    expect(loadTime).toBeLessThan(15000); // Generous timeout for CI
  });
});
