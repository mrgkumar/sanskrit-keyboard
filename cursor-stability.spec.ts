import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

test('Adversarial Cursor Stability Test', async ({ page }) => {
  await page.goto(APP_URL);

  const input = page.getByTestId('sticky-itrans-input');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');

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
