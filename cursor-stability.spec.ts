import { expect, test } from '@playwright/test';

test('Adversarial Cursor Stability Test', async ({ page }) => {
  await page.goto('http://localhost:3000');

  const input = page.getByTestId('sticky-itrans-input');
  const preview = page.getByTestId('sticky-devanagari-preview');

  await expect(input).toBeVisible();
  await input.focus();
  await page.keyboard.type('agniM ile ', { delay: 120 });

  await expect(preview).toContainText('अग्निं');

  await preview.locator('[data-target-index="2"]').evaluate((node) => {
    const target = node as HTMLElement;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: rect.left + 1,
      clientY: rect.top + rect.height / 2,
    }));
  });
  await page.waitForTimeout(300);

  const selectionStart = await input.evaluate((el: HTMLTextAreaElement) => el.selectionStart);
  expect(selectionStart).toBeGreaterThan(0);

  await page.keyboard.type("'", { delay: 120 });
  await expect(preview).toContainText('\u0951');
});
