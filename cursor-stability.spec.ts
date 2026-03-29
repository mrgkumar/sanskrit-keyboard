import { test, expect } from '@playwright/test';

test('Adversarial Cursor Stability Test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  const captureArea = page.locator('textarea');
  await captureArea.waitFor({ state: 'visible' });
  await captureArea.focus();

  console.log('1. Typing base text slowly...');
  await page.keyboard.type('ganesh kumar ', { delay: 200 });
  
  // Verify Unicode rendering
  const visualArea = page.locator('div.font-serif').first();
  await expect(visualArea).toContainText('गणेश कुमार');

  console.log('2. Clicking in the middle of "गणेश" to move cursor...');
  // Calculate a rough position to click (middle of the first word)
  const box = await visualArea.boundingBox();
  if (box) {
    // Click roughly 1/4 into the box
    await page.mouse.click(box.x + 100, box.y + 50);
  }

  // Use a delay to let any jumpy effects happen
  await page.waitForTimeout(500);

  console.log('3. Verifying if cursor is at the beginning (FAILURE) or at the point (SUCCESS)...');
  const selectionStart = await captureArea.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
  console.log(`Native Browser Selection Start: ${selectionStart}`);
  
  // If it's 0, it jumped to the beginning.
  expect(selectionStart).toBeGreaterThan(0);

  console.log('4. Attempting to add an accent at this middle position...');
  await page.keyboard.type("'", { delay: 200 });
  
  const finalContent = await visualArea.innerText();
  console.log(`Final Content: "${finalContent}"`);
  
  // Verify the udatta exists and isn't at the end
  const udattaPos = finalContent.indexOf('\u0951');
  console.log(`Udatta found at index: ${udattaPos}`);
  expect(udattaPos).toBeLessThan(finalContent.length - 2);
  
  await page.screenshot({ path: 'cursor_adversarial_check.png' });
});
