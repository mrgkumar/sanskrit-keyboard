import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';

const TREE_RESPONSE = {
  sha: 'responsive-tree-sha',
  url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/trees/responsive-tree-sha',
  truncated: false,
  tree: [
    {
      path: 'mantras.tex',
      mode: '100644',
      type: 'blob',
      sha: 'mantras-index',
      url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/mantras-index',
      size: 128,
    },
    {
      path: 'mantras/PurushaSuktam.tex',
      mode: '100644',
      type: 'blob',
      sha: 'purusha-suktam',
      url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/purusha-suktam',
      size: 128,
    },
  ],
};

const PURUSHA_SUKTAM = String.raw`\chapt{पुरुषसूक्तम्}

न तस्य कार्यं करणं च विद्यते।

\centerline{ॐ तत्सत्}
`;

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
] as const;

const clearState = async (page: Page) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sanskrit-keyboard-visited', 'true');
  });
};

const mockReaderSources = async (page: Page) => {
  await page.route('**/api.github.com/repos/stotrasamhita/vedamantra-book/git/trees/master**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(TREE_RESPONSE),
    });
  });

  await page.route('**/raw.githubusercontent.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('PurushaSuktam.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: PURUSHA_SUKTAM,
      });
      return;
    }

    if (url.includes('mantras.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: String.raw`\input{mantras/PurushaSuktam.tex}`,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'text/plain; charset=utf-8',
      body: 'not found',
    });
  });
};

const assertNoHorizontalOverflow = async (page: Page) => {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
  }));

  expect(metrics.scrollWidth, 'document overflowed horizontally').toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth, 'body overflowed horizontally').toBeLessThanOrEqual(metrics.bodyClientWidth + 1);
};

test.describe('responsive smoke', () => {
  for (const viewport of viewports) {
    test(`pages fit at ${viewport.name} size`, async ({ page }) => {
      await clearState(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockReaderSources(page);

      await page.goto(APP_URL, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${APP_URL}/welcome`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'The Invisible Interface' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${APP_URL}/reference`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Reference Library' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${APP_URL}/settings/mappings`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Keyboard Customization' })).toBeVisible();
      await assertNoHorizontalOverflow(page);

      await page.goto(`${APP_URL}/reader`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Open reader options' })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test('editor workspace remains usable on compact screens', async ({ page }) => {
    await clearState(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReaderSources(page);

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'New Session' }).click();

    await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
    await expect(page.getByTestId('sticky-preview-primary-pane')).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });
});
