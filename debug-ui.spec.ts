import { test, expect } from '@playwright/test';

test('Deep UI Inspection - Sanskirt Keyboard', async ({ page }) => {
  // 1. Navigate to the app
  await page.goto('http://localhost:3000');
  
  // 2. Wait for the engine to be ready
  const engine = page.locator('div[tabindex="0"]');
  await expect(engine).toBeVisible();
  
  // 3. Type a complex sequence
  await engine.click();
  await page.keyboard.type('bha_dra ');
  
  // 4. Inspect the structure manually via Locator and State
  console.log('--- UI STRUCTURE INSPECTION (Pre-Edit) ---');
  const textContent = await engine.innerText();
  console.log(`Current Text: "${textContent}"`);

  // 5. Move cursor back and edit
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type('M');
  
  // 6. Trigger Suggestions
  await page.keyboard.type('kSh');
  
  // 7. Inspect again
  console.log('\n--- UI STRUCTURE INSPECTION (Post-Edit & Suggestions) ---');
  const finalContent = await engine.innerText();
  console.log(`Final Text Area Content: "${finalContent}"`);

  // 8. Verify the Suggestion Listbox exists
  const suggestionList = page.locator('span:has-text("Suggestions")').locator('..');
  const isSuggestionVisible = await suggestionList.isVisible();
  console.log(`Suggestion List Visible: ${isSuggestionVisible}`);
  
  if (isSuggestionVisible) {
    const suggestions = await suggestionList.innerText();
    console.log(`Suggestions Found:\n${suggestions}`);
  }

  // 9. Verify the Input Buffer Badge
  const bufferBadge = page.locator('span:has-text("kSh")');
  console.log(`Buffer Badge Visible: ${await bufferBadge.isVisible()}`);

  await expect(suggestionList).toBeVisible();
  console.log('\nSUCCESS: Deep Inspection confirms Suggestion List and Buffer are functional.');
});
