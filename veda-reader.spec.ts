import { test, expect } from '@playwright/test';
import {
  READER_MANIFEST_CACHE_KEY,
  READER_PARSED_DOCUMENT_CACHE_PREFIX,
  READER_RAW_DOCUMENT_CACHE_PREFIX,
} from '@/lib/veda-book/constants';
import { parseTexDocument } from '@/lib/veda-book/parseTex';
import { deriveDocumentTitleFromNodes, formatReaderDisplayText, serializeReaderDocumentText } from '@/lib/veda-book/renderText';
import { detransliterate, formatSourceForScript } from '@/lib/vedic/utils';
import { DEFAULT_OUTPUT_TARGET_SETTINGS } from '@/lib/vedic/mapping';

const REPO_TREE = {
  sha: 'tree-sha',
  url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/trees/tree-sha',
  truncated: false,
  tree: [
    { path: 'mantras.tex', mode: '100644', type: 'blob', sha: 'sha-mantras-index', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-mantras-index', size: 120 },
    { path: 'mantras/AnotherMantra.tex', mode: '100644', type: 'blob', sha: 'sha-another', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-another', size: 120 },
    { path: 'mantras/OutlineMantra.tex', mode: '100644', type: 'blob', sha: 'sha-outline', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-outline', size: 120 },
    { path: 'mantras/PurushaSuktam.tex', mode: '100644', type: 'blob', sha: 'sha-purusha', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-purusha', size: 120 },
    { path: 'mantras/nested/DeepMantra.tex', mode: '100644', type: 'blob', sha: 'sha-deep', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-deep', size: 120 },
    ...Array.from({ length: 40 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return {
        path: `mantras/series/Series${number}.tex`,
        mode: '100644',
        type: 'blob',
        sha: `sha-series-${number}`,
        url: `https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-series-${number}`,
        size: 120,
      } as const;
    }),
  ],
};

const REPO_TREE_REFRESHED = {
  ...REPO_TREE,
  sha: 'tree-sha-refreshed',
  tree: [
    ...REPO_TREE.tree,
    { path: 'mantras/RefreshedMantra.tex', mode: '100644', type: 'blob', sha: 'sha-refresh', url: 'https://api.github.com/repos/stotrasamhita/vedamantra-book/git/blobs/sha-refresh', size: 120 },
  ],
};

const APP_URL = process.env.APP_URL ?? 'http://127.0.0.1:3000';
const APP_BASE_PATH = new URL(APP_URL).pathname.replace(/\/$/, '');

const withAppBasePath = (path: string) => {
  if (!APP_BASE_PATH || APP_BASE_PATH === '/') {
    return path;
  }

  return `${APP_BASE_PATH}${path}`;
};

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

const DIAGNOSTICS_MANTRA = String.raw`\chapt{सूचनाः}

प्रथमं अनुच्छेदम्।
द्वितीयं अनुच्छेदम्।
तृतीयं अनुच्छेदम्।
चतुर्थं अनुच्छेदम्।
पञ्चमं अनुच्छेदम्।
षष्ठं अनुच्छेदम्।
सप्तमं अनुच्छेदम्।
अष्टमं अनुच्छेदम्।
नवमं अनुच्छेदम्।
दशमं अनुच्छेदम्।
एकादशं अनुच्छेदम्।
द्वादशं अनुच्छेदम्।
त्रयोदशं अनुच्छेदम्।
चतुर्दशं अनुच्छेदम्।
पञ्चदशं अनुच्छेदम्।
षोडशं अनुच्छेदम्।
सप्तदशं अनुच्छेदम्।
अष्टादशं अनुच्छेदम्।
एकोनविंशतिः अनुच्छेदः।
विंशतिः अनुच्छेदः।

\foo{diagnostic}
`;

const REFRESHED_MANTRA = String.raw`\chapt{नवीनः ग्रन्थः}

अयं तु अद्यतनः पाठः।
`;

const DEEP_MANTRA = String.raw`\chapt{गूढः पाठः}

अयं गुह्यः मन्‍त्रः।
`;

const mockReaderSources = async (page: Parameters<typeof test>[0]['page']) => {
  let treeRequests = 0;

  await page.route('**/api.github.com/repos/stotrasamhita/vedamantra-book/git/trees/master**', async (route) => {
    treeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(treeRequests > 1 ? REPO_TREE_REFRESHED : REPO_TREE),
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

    if (url.includes('DiagnosticsMantra.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: DIAGNOSTICS_MANTRA,
      });
      return;
    }

    if (url.includes('RefreshedMantra.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: REFRESHED_MANTRA,
      });
      return;
    }

    if (url.includes('DeepMantra.tex')) {
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: DEEP_MANTRA,
      });
      return;
    }

    if (url.includes('Series')) {
      const filename = url.split('/').pop()?.split('?')[0]?.replace(/\.tex$/, '') ?? 'Series';
      await route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: String.raw`\chapt{${filename}}

अयं श्रेणीगतः पाठः।
`,
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

    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('veda-reader-cache');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
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

  test('parser supports corpus chapter, subsection, and page break macros', async () => {
    const source = String.raw`
\sect{महानारायणोपनिषत्}
\noindent
\mbox{शान्तिः}
\ip

प्रथमः परिच्छेदः।

\dnsub{उपनिषत्}
द्वितीयः परिच्छेदः।

    \sep
    \small
    \hspace{1em}
    \circ
    \medskip
    \smallskip
    \bigskip
    \newline
    \linebreak
    \pagebreak
    \vspace{1em}
    \vfill
    \par
    \raggedright
    \centering
    \sloppy
    \anuvakamend
    \prashnaend
`;

    const parsed = parseTexDocument(source, { sourcePath: 'mantras/Mahanarayanopanishat.tex' });

    expect(parsed.nodes.some((node) => node.type === 'chapter' && node.text === 'महानारायणोपनिषत्')).toBeTruthy();
    expect(parsed.nodes.some((node) => node.type === 'subsection' && node.text === 'उपनिषत्')).toBeTruthy();
    expect(parsed.nodes.some((node) => node.type === 'pageBreak')).toBeTruthy();
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.message.includes('Unsupported macro'))).toBeFalsy();
  });

  test('uses versioned cache keys for reader data', async () => {
    expect(READER_MANIFEST_CACHE_KEY).toContain(':v3:');
    expect(READER_RAW_DOCUMENT_CACHE_PREFIX).toContain(':v3:');
    expect(READER_PARSED_DOCUMENT_CACHE_PREFIX).toContain(':v3:');
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

  test('normalizes same-script reader text through the shared display pipeline', async () => {
    const devanagariText = String.raw`स॒ह॑स्र॒शीर्‌षा॑`;
    const tamilText = String.raw`ஶாந்தி:‌॒`;

    expect(
      formatReaderDisplayText(devanagariText, 'devanagari', 'devanagari', DEFAULT_OUTPUT_TARGET_SETTINGS),
    ).toBe(devanagariText);
    expect(formatReaderDisplayText(tamilText, 'tamil', 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS)).toBe('ஶாந்தி॒:');
  });

  test('reader devanagari rendering normalizes corpus accent order before translating', async () => {
    const devanagariSource = String.raw`ॐ शं न॒स्तन्नो॒ मा हा॑सीत्॥ ॐ शान्तिः॒ शान्तिः॒ शान्तिः॑॥`;

    expect(formatReaderDisplayText(devanagariSource, 'roman', 'devanagari', DEFAULT_OUTPUT_TARGET_SETTINGS)).toBe(
      "OM shaM na_stanno_ mA hA'sIt|| OM shAnti_: shAnti_: shAnti':||",
    );
    expect(formatReaderDisplayText(devanagariSource, 'tamil', 'devanagari', DEFAULT_OUTPUT_TARGET_SETTINGS)).toBe(
      'ஓம் ஶம் ந॒ஸ்தந்நோ॒ மா ஹா॑ஸீத்॥ ஓம் ஶாந்தி॒: ஶாந்தி॒: ஶாந்தி॑:॥',
    );
    expect(
      formatReaderDisplayText(devanagariSource, 'devanagari', 'devanagari', DEFAULT_OUTPUT_TARGET_SETTINGS),
    ).toContain('शान्ति॒ः');
  });

  test('loads the manifest, renders a document, and supports mode switching', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader'));

    await expect(page.getByText('Veda Reader')).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: /पुरुषसूक्तम्/ }).first()).toBeVisible();
    await expect(page.getByText('mantras', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('nested', { exact: true }).first()).toBeVisible();
    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();
    await expect(page.getByText('Page: A4')).toBeVisible();
    await expect(page.getByText('Type: 19px / 1.75')).toBeVisible();
    await expect(page.locator('main article').first()).toHaveAttribute('style', /max-width:\s*8\.27in/);
    await expect(page.locator('main article').first()).toHaveAttribute('style', /font-size:\s*19px/);
    await expect(page.locator('main article').first()).toHaveAttribute('style', /line-height:\s*1\.75/);
    await expect(page.getByRole('link', { name: 'Open source document' })).toHaveAttribute(
      'href',
      /github\.com\/stotrasamhita\/vedamantra-book\/blob\/master\/mantras\/PurushaSuktam\.tex$/,
    );

    await page.getByRole('button', { name: 'Increase font size' }).click();
    await page.getByRole('button', { name: 'Increase line height' }).click();
    await expect(page.locator('main article').first()).toHaveAttribute('style', /font-size:\s*20px/);
    await expect(page.locator('main article').first()).toHaveAttribute('style', /line-height:\s*1\.85/);

    await page.getByRole('button', { name: 'Web' }).click();
    await expect(page.getByText('Page: Web')).toBeVisible();
    await expect(page.locator('main article').first()).toHaveAttribute('style', /max-width:\s*none/);

    await page.getByRole('button', { name: 'Chandas' }).click();
    await expect(page.locator('main article > header [data-font-preset="chandas"]').first()).toBeVisible();

    await page.getByRole('button', { name: 'Source' }).click();
    await expect(page.getByText('\\chapt{पुरुषसूक्तम्}')).toBeVisible();

    await page.getByRole('button', { name: 'Compare' }).click();
    await expect(page.locator('main article header').getByText('Original', { exact: true })).toBeVisible();
    await expect(page.locator('main article header').getByText('Selected display', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Split' }).click();
    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('\\centerline{ॐ तत्सत्}')).toBeVisible();

    await page.getByRole('button', { name: 'Reader' }).click();
    await page.getByRole('button', { name: 'Devanagari' }).click();
    await page.getByRole('textbox', { name: 'Search document' }).fill('tasya');
    await expect(page.getByText('1/1', { exact: true })).toBeVisible();
    await expect(page.locator('[data-reader-search-hit="true"]').first()).toContainText('न तस्य कार्यं करणं च विद्यते');

    await page.getByRole('button', { name: 'Reader' }).click();
    await page.getByRole('button', { name: 'Original' }).click();
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
    const anotherTamilHeading = formatSourceForScript('अन्य मन्‍त्रः', 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS);
    await expect(page.locator('main article > header').getByRole('heading', { name: anotherTamilHeading })).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: 'अन्य मन्‍त्रः' })).toBeVisible();
    await expect(page).toHaveURL(/\/reader\/\?path=mantras%2FAnotherMantra\.tex$/);
  });

  test('keeps the sidebar scroll position stable when opening a document', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);
    await page.setViewportSize({ width: 1280, height: 320 });

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));

    const sidebarScroll = page.getByTestId('reader-sidebar-scroll');
    await sidebarScroll.evaluate((element) => {
      const sidebarElement = element as HTMLElement;
      sidebarElement.style.height = '80px';
      sidebarElement.style.maxHeight = '80px';
    });

    const scrollMetrics = await sidebarScroll.evaluate((element) => ({
      clientHeight: (element as HTMLElement).clientHeight,
      scrollHeight: (element as HTMLElement).scrollHeight,
    }));
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

    await sidebarScroll.evaluate((element) => {
      (element as HTMLElement).scrollTop = 240;
    });

    const initialScrollTop = await sidebarScroll.evaluate((element) => (element as HTMLElement).scrollTop);
    expect(initialScrollTop).toBeGreaterThan(0);

    const seriesButton = page.getByRole('button', { name: 'Series08' });
    await seriesButton.evaluate((button) => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    });

    await expect
      .poll(async () => sidebarScroll.evaluate((element) => (element as HTMLElement).scrollTop), {
        timeout: 2000,
      })
      .toBe(initialScrollTop);
  });

  test('collapses and expands reader folders without flattening the tree', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));

    const folderToggle = page.getByTestId('reader-folder-toggle-mantras');
    await expect(folderToggle).toBeVisible();
    await expect(page.getByRole('button', { name: 'Series08' })).toBeVisible();

    await folderToggle.click();
    await expect(page.getByRole('button', { name: 'Series08' })).toHaveCount(0);

    await folderToggle.click();
    await expect(page.getByRole('button', { name: 'Series08' })).toBeVisible();
  });

  test('opens a specific document from the route path', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/PurushaSuktam.tex'));

    await expect(page.locator('main article > header').getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible();
    await expect(page.getByText('stotrasamhita/vedamantra-book · master', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open source document' })).toHaveAttribute(
      'href',
      /github\.com\/stotrasamhita\/vedamantra-book\/blob\/master\/mantras\/PurushaSuktam\.tex$/,
    );
    await expect(page.getByRole('button', { name: 'Split' })).toBeVisible();
    await expect(page.getByText('Script: Devanagari')).toBeVisible();
  });

  test('renders search result list and jumps to the selected match', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));
    await page.getByRole('button', { name: 'Devanagari' }).click();
    await page.getByRole('button', { name: 'Open document search' }).click();

    const searchPanel = page.getByTestId('reader-search-panel');
    await expect(searchPanel).toBeVisible();

    await searchPanel.getByTestId('reader-search-input').fill('अनुच्छेद');

    await expect(searchPanel.getByText(/matches/)).toBeVisible();
    await expect(searchPanel.locator('[aria-pressed]')).toHaveCount(17);
    await expect(page.locator('[data-reader-search-word-hit="true"]').first()).toBeVisible();

    await searchPanel.locator('[aria-pressed]').nth(1).click();

    await expect(searchPanel.getByText('2/17', { exact: true })).toBeVisible();
    await expect(page.getByText('2/17', { exact: true })).toBeVisible();
  });

  test('reader search panel renders hits in the selected script font', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/PurushaSuktam.tex'));
    await page.getByRole('button', { name: 'Tamil' }).click();
    await page.getByRole('button', { name: 'Open document search' }).click();

    const searchPanel = page.getByTestId('reader-search-panel');
    await searchPanel.getByTestId('reader-search-input').fill('tasya');

    await expect(searchPanel.getByText(/match/i)).toBeVisible();
    await expect(searchPanel.locator('[data-font-preset="anek"]').first()).toBeVisible();
    await expect(page.locator('[data-reader-search-word-hit="true"]').first()).toBeVisible();
  });

  test('pasting devanagari into the reader search converts it to itrans', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/PurushaSuktam.tex'));
    await page.getByRole('button', { name: 'Open document search' }).click();

    const searchInput = page.getByTestId('reader-search-input');
    const devanagariText = 'पुरुषसूक्तम्';
    const expectedItrans = detransliterate(devanagariText);

    await searchInput.evaluate((element, text) => {
      const input = element as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', String(text));
      input.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        }),
      );
    }, devanagariText);

    await expect(searchInput).toHaveValue(expectedItrans);
    await expect(page.locator('[data-reader-search-word-hit="true"]').first()).toBeVisible();
  });

  test('pasting tamil into the reader search converts it to itrans', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/PurushaSuktam.tex'));
    await page.getByRole('button', { name: 'Open document search' }).click();

    const searchInput = page.getByTestId('reader-search-input');
    const tamilText = formatSourceForScript('पुरुषसूक्तम्', 'tamil', DEFAULT_OUTPUT_TARGET_SETTINGS);
    const expectedItrans = detransliterate(tamilText);

    await searchInput.evaluate((element, text) => {
      const input = element as HTMLInputElement;
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', String(text));
      input.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: dataTransfer,
        }),
      );
    }, tamilText);

    await expect(searchInput).toHaveValue(expectedItrans);
    await expect(page.locator('[data-reader-search-word-hit="true"]').first()).toBeVisible();
  });

  test('double escape clears the search query', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));
    await page.getByRole('button', { name: 'Open document search' }).click();

    const searchPanel = page.getByTestId('reader-search-panel');
    await searchPanel.getByTestId('reader-search-input').fill('अनुच्छेद');
    await expect(page.locator('[data-reader-search-word-hit="true"]')).toHaveCount(17);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await expect(searchPanel).toHaveCount(0);
    await page.getByRole('button', { name: 'Open document search' }).click();
    await expect(page.getByTestId('reader-search-input')).toHaveValue('');
  });

  test('diagnostic entries jump to the rendered warning block', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);
    await page.setViewportSize({ width: 1280, height: 520 });

    await page.goto(withAppBasePath('/reader?path=mantras/DiagnosticsMantra.tex'));
    await page.getByRole('button', { name: 'Diagnostics' }).click();

    const warningBlock = page.locator('main article').getByText('Unsupported macro(s): \\foo', { exact: true });

    await expect(warningBlock).not.toBeInViewport();
    await page.getByTestId('reader-diagnostics-panel').getByTestId('diagnostic-jump').click();
    await expect(warningBlock).toBeInViewport();
  });

  test('refreshes the manifest when the reader regains focus', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);

    await page.goto(withAppBasePath('/reader'));

    await expect(page.locator('aside').getByRole('button', { name: /पुरुषसूक्तम्/ }).first()).toBeVisible();
    await expect(page.locator('aside').getByRole('button', { name: /Refreshed Mantra/ })).toHaveCount(0);

    await page.evaluate(() => {
      window.dispatchEvent(new FocusEvent('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await expect(page.locator('aside').getByRole('button', { name: /Refreshed Mantra/ }).first()).toBeVisible();
  });

  test('renders a document outline and jumps to the selected section', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);
    await page.setViewportSize({ width: 1280, height: 520 });

    const outlineDocument = parseTexDocument(OUTLINE_MANTRA, { sourcePath: 'mantras/OutlineMantra.tex' });
    const subsectionNode = outlineDocument.nodes.find((node) => node.type === 'subsection');

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));

    await expect(page.getByRole('navigation', { name: 'Document outline' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'द्वितीयः विभागः' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'सूक्ष्मः उपविभागः' })).toBeVisible();

    const targetNode = page.locator(`#${subsectionNode?.id ?? 'subsection-1'}`);

    await page.getByRole('link', { name: 'सूक्ष्मः उपविभागः' }).click();

    await expect(targetNode).toBeInViewport();
    await expect(page.getByTestId('reader-document-scroll')).toBeVisible();
  });

  test('restores the last read position when reopening a document', async ({ page }) => {
    await mockReaderSources(page);
    await clearReaderStorage(page);
    await page.setViewportSize({ width: 1280, height: 520 });

    await page.goto(withAppBasePath('/reader?path=mantras/OutlineMantra.tex'));

    const scrollRegion = page.getByTestId('reader-document-scroll');
    await scrollRegion.hover();
    await page.mouse.wheel(0, 1800);
    await page.waitForTimeout(150);

    const initialScrollTop = await scrollRegion.evaluate((element) => (element as HTMLElement).scrollTop);

    await expect(initialScrollTop).toBeGreaterThan(0);

    const storedPositions = await page.evaluate(() => window.localStorage.getItem('veda-reader-last-read-positions-v1'));
    expect(storedPositions ?? '').toContain('mantras/OutlineMantra.tex');

    await page.getByRole('button', { name: 'Another Mantra' }).click();
    await page.getByRole('button', { name: 'दीर्घपाठम्' }).click();

    await expect(scrollRegion).toBeVisible();

    await expect
      .poll(async () => scrollRegion.evaluate((element) => (element as HTMLElement).scrollTop), {
        timeout: 5000,
      })
      .toBeGreaterThan(0);

    const restoredScrollTop = await scrollRegion.evaluate((element) => (element as HTMLElement).scrollTop);
    expect(Math.abs(restoredScrollTop - initialScrollTop)).toBeLessThan(20);
  });

  test('manual live upstream verification only', async ({ page }) => {
    test.skip(process.env.LIVE_UPSTREAM !== '1', 'manual live upstream verification only');

    await page.goto(withAppBasePath('/reader?path=mantras/PurushaSuktam.tex'));

    await expect(page.getByRole('heading', { name: 'पुरुषसूक्तम्' })).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByRole('button', { name: 'Source' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Split' })).toBeVisible();
  });
});
