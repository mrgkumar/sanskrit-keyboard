import { test, expect } from '@playwright/test';
import { parseTexDocument } from '@/lib/veda-book/parseTex';
import { deriveDocumentTitleFromNodes, serializeReaderDocumentText } from '@/lib/veda-book/renderText';
import { detransliterate, formatSourceForScript } from '@/lib/vedic/utils';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';

const MANTRAS_INDEX = String.raw`\input{mantras/PurushaSuktam.tex}
\input{mantras/AnotherMantra.tex}
\input{mantras/OutlineMantra.tex}
`;

const PURUSHA_SUKTAM = String.raw`\chapt{पुरुषसूक्तम्}

न तस्य कार्यं करणं च विद्यते।

\centerline{ॐ तत्सत्}

\foo{diagnostic}
`;

const ANOTHER_MANTRA = String.raw`\chapt{अन्य मन्‍त्रः}

द्वितीयं परीक्षणम्।
`;

const OUTLINE_MANTRA = String.raw`\chapt{दीर्घपाठम्}

प्रथमं अनुच्छेदम्।

प्रथमं अनुवर्तनम्।

द्वितीयं अनुच्छेदम्।

तृतीयं अनुच्छेदम्।

चतुर्थं अनुच्छेदम्।

पञ्चमं अनुच्छेदम्।

षष्ठं अनुच्छेदम्।

सप्तमं अनुच्छेदम्।

\section{द्वितीयः विभागः}

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

अनेके अनुच्छेदाः।

\subsection{सूक्ष्मः उपविभागः}

अन्तिमं पङ्क्तिः।
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

    if (url.includes('OutlineMantra.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: OUTLINE_MANTRA,
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

const clearReaderStorage = async (page: Parameters<typeof test>[0]['page']) => {
  await page.addInitScript(async () => {
    window.localStorage.clear();

    if ('databases' in indexedDB) {
      const databases = await indexedDB.databases();
      await Promise.all(
        databases
          .map((database) => database.name)
          .filter((name): name is string => Boolean(name))
          .map(async (name) => {
            await new Promise<void>((resolve) => {
              const request = indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            });
          }),
      );
    }
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

  test('derives document titles from parsed header nodes', async () => {
    const parsed = parseTexDocument(PURUSHA_SUKTAM, { sourcePath: 'mantras/PurushaSuktam.tex' });
    expect(deriveDocumentTitleFromNodes(parsed.nodes, 'Purusha Suktam')).toBe('पुरुषसूक्तम्');
    const unsupported = parsed.diagnostics.find((diagnostic) => diagnostic.message.includes('\\foo'));
    expect(unsupported?.line).toBe(7);
    expect(unsupported?.column).toBe(1);
  });

  test('serializes visible reader text using the shared transliteration engine', async () => {
    const parsed = parseTexDocument(PURUSHA_SUKTAM, { sourcePath: 'mantras/PurushaSuktam.tex' });
    const document = {
      id: 'mantras/PurushaSuktam.tex',
      title: deriveDocumentTitleFromNodes(parsed.nodes, 'Purusha Suktam'),
      sourceRepo: 'stotrasamhita/vedamantra-book',
      sourceBranch: 'master',
      sourcePath: 'mantras/PurushaSuktam.tex',
      rawTex: PURUSHA_SUKTAM,
      nodes: parsed.nodes,
      diagnostics: parsed.diagnostics,
      fetchedAt: '2026-04-26T00:00:00.000Z',
    };

    const romanText = serializeReaderDocumentText(document, 'roman', DEFAULT_OUTPUT_TARGET_SETTINGS);
    const tamilText = serializeReaderDocumentText(document, 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS);

    expect(romanText).toContain(detransliterate('पुरुषसूक्तम्'));
    expect(tamilText).toContain('ப');
    expect(tamilText).not.toContain('पुरुषसूक्तम्');
  });

  test('loads the manifest, renders a document, and supports mode switching', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto('/reader');

    await expect(page.getByText('Veda Reader')).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: /पुरुषसूक्तम्/ }).first()).toBeVisible();
    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();

    await page.getByRole('button', { name: 'Source' }).click();
    await expect(page.getByText('\\chapt{पुरुषसूक्तम्}')).toBeVisible();

    await page.getByRole('button', { name: 'Split' }).click();
    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('\\centerline{ॐ तत्सत्}')).toBeVisible();

    await page.getByRole('button', { name: 'Reader' }).click();
    await expect(page.getByText('Display: Original')).toBeVisible();

    const romanHeading = detransliterate('पुरुषसूक्तम्');
    await page.getByRole('button', { name: 'Roman' }).click();
    await expect(page.getByText('Display: Roman')).toBeVisible();
    await expect(page.locator('main article > header').getByRole('heading', { name: romanHeading })).toBeVisible();

    const tamilHeading = formatSourceForScript(
      romanHeading,
      'tamil',
      DEFAULT_OUTPUT_TARGET_SETTINGS,
    );
    await page.getByRole('button', { name: 'Tamil' }).click();
    await expect(page.getByText('Display: Tamil')).toBeVisible();
    await expect(page.locator('main article > header').getByRole('heading', { name: tamilHeading })).toBeVisible();

    await page.getByRole('button', { name: 'Diagnostics' }).click();
    await expect(page.getByTestId('reader-diagnostics-panel').getByText('L7:1').first()).toBeVisible();
    await expect(page.getByTestId('reader-diagnostics-panel').getByText('Unsupported macro(s): \\foo').first()).toBeVisible();

    await page.getByPlaceholder('Search titles or paths').fill('Another');
    await page.getByRole('button', { name: 'Another Mantra' }).click();
    await expect(page.locator('main article > header').getByRole('heading', { name: 'अन्य मन्‍त्रः' })).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: 'अन्य मन्‍त्रः' })).toBeVisible();
    await expect(page).toHaveURL(/\/reader\/\?path=mantras%2FAnotherMantra\.tex$/);
  });

  test('opens a specific document from the route path', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto('/reader?path=mantras/PurushaSuktam.tex');

    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('stotrasamhita/vedamantra-book · master', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split' })).toBeVisible();
    await expect(page.getByText('Script: Devanagari')).toBeVisible();
  });

  test('renders a document outline and jumps to the selected section', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);
    await page.setViewportSize({ width: 1280, height: 520 });

    const outlineDocument = parseTexDocument(OUTLINE_MANTRA, { sourcePath: 'mantras/OutlineMantra.tex' });
    const subsectionNode = outlineDocument.nodes.find((node) => node.type === 'subsection');

    await page.goto('/reader?path=mantras/OutlineMantra.tex');

    await expect(page.getByRole('navigation', { name: 'Document outline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'द्वितीयः विभागः' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'सूक्ष्मः उपविभागः' })).toBeVisible();

    const targetNode = page.locator(`#${subsectionNode?.id ?? 'subsection-1'}`);

    await page.getByRole('link', { name: 'सूक्ष्मः उपविभागः' }).click();

    await expect(targetNode).toBeInViewport();
    await expect(page.getByTestId('reader-document-scroll')).toBeVisible();
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
