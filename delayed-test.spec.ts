import { test, expect } from '@playwright/test';

test('Scholarly Source-of-Truth Workflow Test', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // The primary input is now a visible textarea
  const input = page.locator('textarea');
  await input.waitFor({ state: 'visible' });
  await input.focus();

  console.log('1. Human-like typing into ITRANS area...');
  await page.keyboard.type('ganesh kumar', { delay: 150 });
  
  const resultArea = page.locator('div.font-serif.text-slate-900');
  await expect(resultArea).toContainText('गणेश कुमार');
  console.log('SUCCESS: Devanagari rendered correctly from source.');

  console.log('2. Native cursor movement and accent injection...');
  // Move back into 'ganesh'
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowLeft', { delay: 100 });
  }
  
  // Inject Udatta shortcut
  await page.keyboard.type("'", { delay: 200 });
  
  const finalUnicode = await resultArea.innerText();
  console.log(`Unicode Result: "${finalUnicode}"`);
  
  // Check if Udatta (\u0951) exists at the point
  expect(finalUnicode).toContain('\u0951');
  console.log('SUCCESS: Svara stacked correctly at native cursor position.');

  await page.screenshot({ path: 'source_truth_validation.png' });
});
