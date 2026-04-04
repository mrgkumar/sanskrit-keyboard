import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

test('clicking a line in document mode does not cause an intrusive scroll jump', async ({ page }) => {
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.setViewportSize({ width: 800, height: 600 });
  
  // 1. Load the app and clear storage
  await page.goto(APP_URL);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();

  // 2. Paste text with Devanagari to trigger addBlocks
  const userTextLine = `नमस्ते line 1
line 2
line 3
line 4
line 5`;
  const longUserText = Array(100).fill(userTextLine).join('\n\n');

  await page.getByTestId('sticky-itrans-input').evaluate((node, pastedText) => {
    const textarea = node as HTMLTextAreaElement;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', pastedText);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: clipboardData,
    });
    textarea.dispatchEvent(pasteEvent);
  }, longUserText);

  await page.waitForTimeout(1000);

  // 3. Switch to Document mode
  await page.getByLabel('Document mode').click();
  
  const blocks = page.locator('[data-testid^="document-canvas-block-"]');
  const blockCount = await blocks.count();

  // 4. Scroll to middle of the document container
  const scrollContainer = page.getByTestId('main-document-scroll-container');
  await scrollContainer.evaluate((el) => {
    el.scrollTop = 2000;
  });
  await page.waitForTimeout(500);

  const initialScrollTop = await scrollContainer.evaluate((el) => el.scrollTop);
  console.log(`Initial ScrollTop: ${initialScrollTop}`);
  
  // 5. Find a block at the bottom half of the viewport
  let targetBlock = null;
  for (let i = 0; i < blockCount; i++) {
    const block = blocks.nth(i);
    const box = await block.boundingBox();
    // box.y is relative to viewport. We want something visible but not centered.
    // Viewport is 0 to 600. Center is 300.
    if (box && box.y > 400 && box.y < 550) {
      targetBlock = block;
      break;
    }
  }

  if (!targetBlock) {
     throw new Error("Could not find a block in the target viewport range");
  }

  const targetId = await targetBlock.getAttribute('data-testid');
  const targetBox = await targetBlock.boundingBox();
  console.log(`Clicking block ${targetId} at viewport y=${targetBox?.y}`);

  // Need to ensure composer is focused BEFORE clicking to test preventDefault properly
  await page.getByTestId('sticky-itrans-input').focus();
  
  // Use dispatchEvent to avoid Playwright's auto-scrolling
  await targetBlock.evaluate((node) => {
    const event = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    });
    node.dispatchEvent(event);
  });

  // 6. Check if it jumped
  await page.waitForTimeout(1500);
  
  const finalScrollTop = await scrollContainer.evaluate((el) => el.scrollTop);
  console.log(`Final ScrollTop: ${finalScrollTop}`);

  const scrollDiff = Math.abs(finalScrollTop - initialScrollTop);
  console.log(`Scroll difference: ${scrollDiff}`);

  // It should NOT jump significantly.
  expect(scrollDiff).toBeLessThan(20);

  // Check if composer is still focused
  const isFocused = await page.getByTestId('sticky-itrans-input').evaluate((el) => document.activeElement === el);
  console.log('Is composer focused:', isFocused);
  expect(isFocused).toBe(true);
});
