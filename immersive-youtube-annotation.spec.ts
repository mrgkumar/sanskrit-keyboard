import { expect, test } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';

test('immersive paragraph YouTube links autosave and open in a new tab', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 });

  await page.goto(APP_URL);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('sanskrit-keyboard-visited', 'true');
  });
  await page.reload();

  const newSessionBtn = page.getByRole('button', { name: /New Session/i });
  if (await newSessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newSessionBtn.click();
  }

  const textarea = page.getByTestId('sticky-itrans-input');
  await expect(textarea).toBeVisible({ timeout: 15000 });
  await textarea.fill('om namah shivaya');

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();

  const firstBlock = page.locator('[data-testid^="document-immersive-block-"]').first();
  await firstBlock.hover();
  await expect(page.getByLabel('Add paragraph YouTube link')).toBeVisible();
  await page.getByLabel('Add paragraph YouTube link').click();

  const popup = page.getByTestId('paragraph-link-popover');
  await expect(popup).toBeVisible();
  const linkInput = popup.locator('input#paragraph-link-input');
  await linkInput.fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  await popup.getByRole('button', { name: 'Save' }).click();

  const savedSnapshot = await page.evaluate(() => {
    const key = Object.keys(window.localStorage).find((item) => item.startsWith('sanskrit-keyboard.session.v2.'));
    return key ? JSON.parse(window.localStorage.getItem(key) ?? 'null') : null;
  });

  expect(savedSnapshot?.annotations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        kind: 'youtube',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      }),
    ])
  );

  await firstBlock.hover();
  const openLink = page.getByLabel('Open paragraph YouTube link');
  await expect(openLink).toBeVisible();

  const popupPromise = page.waitForEvent('popup');
  await openLink.click();
  const newTab = await popupPromise;
  await expect(newTab).toHaveURL(/youtube\.com|youtu\.be/);
});
