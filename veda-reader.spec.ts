import { test, expect } from '@playwright/test';
import { parseTexDocument } from '@/lib/veda-book/parseTex';

const MANTRAS_INDEX = String.raw`\input{mantras/PurushaSuktam.tex}
\input{mantras/AnotherMantra.tex}
`;

const PURUSHA_SUKTAM = String.raw`\chapt{पुरुषसूक्तम्}

न तस्य कार्यं करणं च विद्यते।

\centerline{ॐ तत्सत्}

\foo{diagnostic}
`;

const ANOTHER_MANTRA = String.raw`\chapt{अन्य मन्‍त्रः}

द्वितीयं परीक्षणम्।
`;

const mockReaderSources = async (page: Parameters<typeof test>[0]['page']) => {
  await page.route('**/raw.githubusercontent.com/**', async (route) => {
    const url = route.request().url();

    if (url.includes('mantras.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: MANTRAS_INDEX,
      });
      return;
    }

    if (url.includes('PurushaSuktam.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: PURUSHA_SUKTAM,
      });
      return;
    }

    if (url.includes('AnotherMantra.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: ANOTHER_MANTRA,
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

test.describe('Veda Reader', () => {
  test('parser preserves visible percent-prefixed verse lines and ignores boilerplate wrappers', async () => {
    const source = String.raw`
% !TeX root = vedamantrabook.tex
\begingroup
\chapt{पुरुषसूक्तम्}

% स॒हस्र॑शीर्‌षा॒ पुरु॑षः।
% स॒ह॒स्रा॒क्षः स॒हस्र॑पात्।
\endgroup
`;

    const parsed = parseTexDocument(source, { sourcePath: 'mantras/PurushaSuktam.tex' });

    expect(parsed.nodes.some((node) => node.type === 'chapter' && node.text === 'पुरुषसूक्तम्')).toBeTruthy();
    expect(
      parsed.nodes.some(
        (node) => node.type === 'paragraph' && node.text.includes('स॒हस्र॑शीर्‌षा॒ पुरु॑षः।'),
      ),
    ).toBeTruthy();
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.message.includes('begingroup'))).toBeFalsy();
  });

  test('loads the manifest, renders a document, and supports mode switching', async ({ page }) => {
    await mockReaderSources(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto('/reader');

    await expect(page.getByText('Veda Reader')).toBeVisible();
    await expect(page.getByText('पुरुषसूक्तम्')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();

    await page.getByRole('button', { name: 'Source' }).click();
    await expect(page.getByText('\\chapt{पुरुषसूक्तम्}')).toBeVisible();

    await page.getByRole('button', { name: 'Split' }).click();
    await expect(page.getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('\\centerline{ॐ तत्सत्}')).toBeVisible();

    await page.getByRole('button', { name: 'Diagnostics' }).click();
    await expect(page.getByTestId('reader-diagnostics-panel').getByText('Unsupported macro(s): \\foo')).toBeVisible();

    await page.getByPlaceholder('Search titles or paths').fill('Another');
    await page.getByRole('button', { name: 'Another Mantra' }).click();
    await expect(page.getByRole('heading', { name: 'अन्य मन्‍त्रः' })).toBeVisible();
  });

  test('opens a specific document from the route path', async ({ page }) => {
    await mockReaderSources(page);
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto('/reader?path=mantras/PurushaSuktam.tex');

    await expect(page.getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('stotrasamhita/vedamantra-book · master', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split' })).toBeVisible();
  });

  test('manual live upstream verification only', async ({ page }) => {
    test.skip(process.env.LIVE_UPSTREAM !== '1', 'manual live upstream verification only');

    await page.goto('/reader?path=mantras/PurushaSuktam.tex');

    await expect(page.getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split' })).toBeVisible();
  });
});
