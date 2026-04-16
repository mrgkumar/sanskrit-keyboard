import { expect, test, type Page } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils.ts';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

const loadDefaultSession = async (page: Page) => {
  await page.addInitScript((keys) => {
    window.localStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sanskrit-keyboard.session.v2.'))
      .forEach((key) => window.localStorage.removeItem(key));
    
    // Bypass onboarding
    window.localStorage.setItem('sanskrit-keyboard-visited', 'true');
  }, STORAGE_KEYS_TO_CLEAR);
  await page.goto(APP_URL);

  // Handle Session Landing if it appears
  const newSessionBtn = page.getByRole('button', { name: /New Session/i });
  if (await newSessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await newSessionBtn.click();
  }

  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible({ timeout: 15000 });
  page.on('dialog', (dialog) => dialog.accept());
  // Removed old workspace navigation that was meant for an older UI version
};

const setReadAs = async (page: Page, script: 'devanagari' | 'roman' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click();
};

const openDisplaySettings = async (page: Page) => {
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.locator('button').filter({ hasText: /^Display$/ }).click();
};

const setRangeValue = async (page: Page, label: string, value: string) => {
  const control = page.locator('label', { hasText: label }).first();
  const slider = control.locator('input[type="range"]').first();
  if (await slider.count()) {
    await slider.focus();
    const currentValue = Number(await slider.inputValue());
    const targetValue = Number(value);
    const stepCount = Math.abs(targetValue - currentValue);
    const key = targetValue >= currentValue ? 'ArrowRight' : 'ArrowLeft';

    for (let index = 0; index < stepCount; index += 1) {
      await slider.press(key);
    }
    return;
  }

  const targetValue = Number(value);
  const currentText = (await control.textContent()) ?? '';
  const currentValue = Number(currentText.match(/(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  const stepCount = Math.abs(targetValue - currentValue);
  const buttonName = targetValue >= currentValue ? `Increase ${label}` : `Decrease ${label}`;
  for (let index = 0; index < stepCount; index += 1) {
    await page.getByRole('button', { name: buttonName }).click();
  }
};

const pasteText = async (page: Page, text: string) => {
  await page.getByTestId('sticky-itrans-input').evaluate((node, pastedText) => {
    const textarea = node as HTMLTextAreaElement;
    const clipboardData = new DataTransfer();
    clipboardData.setData('text', pastedText);
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: clipboardData,
    });
    textarea.dispatchEvent(pasteEvent);
  }, text);
};

const LONG_SNIPPET =
  "a_rya_mNo vaa e_tannakSha'ttram | yatpuurve_ phalgu'nii | a_rya_meti_ tamaa'hu_ryo dadaa'ti | daana'kaamaa asmai pra_jaa bha'vanti | ya kaa_maye'ta bha_gii syaa_miti' | sa utta'rayo_ phalgu'nyora_gnimaada'dhiita | bhaga'sya_ vaa e_tannakSha'ttram | yadutta're_ phalgu'nii | bha_gye'va bha'vati | kaa_la_ka_~njaa vai naamaasu'raa Asann || 9 || still the font size is large gaaya_triiM gaNeshkumaar shanti shanti gani vidv surya ravi naraayana swami gaNeshkumaar vishveshvari aruna tachCha_myai' shami_tvam | yachCha'mii_maya'ssambhaa_ro bhava'ti | shaantyaa_ apra'daahaaya | a_gnessR^i_STasya' ya_ta: | vika'~NkataM_ bhaa A''rchChat | yada_shani'hatasya vR^i_kShasya' sambhaa_ro bhava'ti | sahR^i'dayame_vaagnimaa dha'tte || 25 ||";

test('delete toast auto-dismisses after a short timeout', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTitle('Delete block').first().click();
  await expect(page.getByTestId('recently-deleted-block')).toBeVisible();
  await page.waitForTimeout(5600);
  await expect(page.getByTestId('recently-deleted-block')).toHaveCount(0);
});

test('backspace correction replaces the intended suffix', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('prri');
  await page.keyboard.press('Backspace');

  await expect(page.getByText('Correction Help')).toBeVisible();
  await page.locator('button').filter({ has: page.getByText('RRi') }).first().click();
  await expect(textarea).toHaveValue('pRRi');
});

test('clicking a correction keeps the caret at the replacement point', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('rri');
  await page.keyboard.press('Backspace');

  const correctionButton = page.locator('button').filter({ has: page.getByText('RRi') }).first();
  await correctionButton.click();

  await expect(textarea).toHaveValue('RRi');
  const selectionStart = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart);
  const selectionEnd = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionEnd);
  expect(selectionStart).toBe(3);
  expect(selectionEnd).toBe(3);
});

test('read and review modes visibly change the document view', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await expect(page.getByRole('button', { name: 'Focus' })).toHaveCount(0);
  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-mode')).toBeVisible();

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toBeVisible();
});

test('Tamil read-as mode and Tamil compare mode both surface Tamil highlights', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill("ma'");

  await setReadAs(page, 'tamil');
  const primaryPane = page.getByTestId('sticky-preview-primary-pane');
  await expect(primaryPane).toContainText('ம॑');

  await page.getByTestId('sticky-compare-chip').click();
  await page.getByTestId('sticky-compare-option-tamil').click();
  const comparePane = page.getByTestId('sticky-preview-compare-pane');
  await expect(comparePane).toContainText('ம॑');
  await expect(comparePane.getByTestId('preview-caret')).toBeVisible();
  await expect(comparePane.locator('[data-current-word="true"]').first()).toBeVisible();
});

test('Tamil preview renders the same precision accents as immersive Tamil mode', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill("jaata'vedo");

  await setReadAs(page, 'tamil');

  const preview = page.getByTestId('sticky-preview-primary-pane');
  await expect(preview).toContainText('ஜாத॑வேதோ³');

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  const immersiveDocument = page.getByTestId('document-immersive-mode');
  await expect(immersiveDocument).toContainText('ஜாத॑வேதோ³');
});

test('Tamil read-as word predictions render in Tamil and omit the selected badge', async ({ page }) => {
  await loadDefaultSession(page);
  await setReadAs(page, 'tamil');

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');

  await expect(page.getByRole('button', { name: 'Peek quick selections' })).toBeVisible();
  await page.getByRole('button', { name: 'Peek quick selections' }).click();

  const tray = page.getByTestId('word-predictions-footer');
  await expect(tray).toBeVisible({ timeout: 10000 });
  await expect(tray).toContainText('க³');
  await expect(tray).not.toContainText('Selected');
});

test('dragging the ITRANS resize handle persists the panel height across reloads', async ({ page }) => {
  await loadDefaultSession(page);

  const panel = page.getByTestId('sticky-itrans-panel');
  const initialHeight = await panel.evaluate((node) => Number.parseFloat(getComputedStyle(node).height));
  const handle = page.getByLabel('Resize ITRANS input height');
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error('Expected resize handle to be visible');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 48, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => panel.evaluate((node) => Number.parseFloat(getComputedStyle(node).height))).toBeGreaterThan(initialHeight);

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
  await expect.poll(async () => page.getByTestId('sticky-itrans-panel').evaluate((node) => Number.parseFloat(getComputedStyle(node).height))).toBeGreaterThan(initialHeight);
});

test('dragging the compare split handle resizes both preview panes', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTestId('sticky-compare-chip').click();
  await page.getByTestId('sticky-compare-option-devanagari').click();

  const primaryPane = page.getByTestId('sticky-preview-primary-pane');
  const comparePane = page.getByTestId('sticky-preview-compare-pane');
  const initialPrimaryHeight = await primaryPane.evaluate((node) => Number.parseFloat(getComputedStyle(node).height));
  const initialCompareHeight = await comparePane.evaluate((node) => Number.parseFloat(getComputedStyle(node).height));
  const handle = page.getByLabel('Resize compare split');
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error('Expected compare split handle to be visible');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 48, { steps: 8 });
  await page.mouse.up();

  await expect.poll(async () => primaryPane.evaluate((node) => Number.parseFloat(getComputedStyle(node).height))).toBeGreaterThan(initialPrimaryHeight);
  await expect.poll(async () => comparePane.evaluate((node) => Number.parseFloat(getComputedStyle(node).height))).toBeLessThan(initialCompareHeight);
});

test('clicking roman and compare preview words places the cursor inside the clicked word', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const sample = 'agniM ile purohitaM yajnasya';
  const targetWord = 'purohitaM';
  const targetStart = sample.indexOf(targetWord);
  const targetEnd = targetStart + targetWord.length;

  await textarea.fill(sample);
  await setReadAs(page, 'roman');
  await page.getByTestId('sticky-compare-chip').click();
  await page.getByTestId('sticky-compare-option-devanagari').click();

  const primaryPane = page.getByTestId('sticky-preview-primary-pane');
  await primaryPane.locator(`[data-source-start="${targetStart}"]`).click();
  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBeGreaterThanOrEqual(targetStart);
  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBeLessThanOrEqual(targetEnd);

  const comparePane = page.getByTestId('sticky-preview-compare-pane');
  await comparePane.locator(`[data-source-start="${targetStart}"]`).click();
  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBeGreaterThanOrEqual(targetStart);
  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBeLessThanOrEqual(targetEnd);
});

test('dragging the composer width handle resizes the input and preview columns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loadDefaultSession(page);

  const handle = page.getByLabel('Resize composer width');
  const box = await handle.boundingBox();

  if (!box) {
    throw new Error('Expected composer width handle to be visible');
  }

  const initialSizes = await handle.evaluate((node) => {
    const sourcePane = node.previousElementSibling as HTMLElement | null;
    const previewPane = node.nextElementSibling as HTMLElement | null;

    if (!sourcePane || !previewPane) {
      throw new Error('Expected width handle to sit between the source and preview panes');
    }

    return {
      sourceWidth: Number.parseFloat(getComputedStyle(sourcePane).width),
      previewWidth: Number.parseFloat(getComputedStyle(previewPane).width),
    };
  });

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 96, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect.poll(async () =>
    handle.evaluate((node) => {
      const sourcePane = node.previousElementSibling as HTMLElement | null;
      if (!sourcePane) {
        return 0;
      }
      return Number.parseFloat(getComputedStyle(sourcePane).width);
    })
  ).toBeGreaterThan(initialSizes.sourceWidth);
  await expect.poll(async () =>
    handle.evaluate((node) => {
      const previewPane = node.nextElementSibling as HTMLElement | null;
      if (!previewPane) {
        return 0;
      }
      return Number.parseFloat(getComputedStyle(previewPane).width);
    })
  ).toBeLessThan(initialSizes.previewWidth);
});

test('immersive mode leaves the first line below the fixed workspace controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Immersive mode' }).click();

  const control = page.getByTestId('workspace-toggle');
  const firstBlock = page.getByTestId('document-immersive-block-block-1');

  await expect(control).toBeVisible();
  await expect(firstBlock).toBeVisible();

  const boxes = await Promise.all([control.boundingBox(), firstBlock.boundingBox()]);
  const [controlBox, blockBox] = boxes;

  if (!controlBox || !blockBox) {
    throw new Error('Expected both the workspace control and first immersive block to be visible');
  }

  expect(blockBox.y).toBeGreaterThan(controlBox.y + controlBox.height);
});

test('clicking Tamil preview text moves the edit cursor to the clicked chunk', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('agniM ile purohitaM');
  await setReadAs(page, 'tamil');

  const preview = page.getByTestId('sticky-preview-primary-pane');
  await expect(preview).toContainText('அக்³நி');
  const before = await textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart);

  await preview.locator('[data-target-index="0"]').click();

  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).not.toBe(before);
  await expect.poll(async () => textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).toBeGreaterThan(0);
});

test('clicking read or immersive text jumps back into edit mode at the clicked word', async ({ page }) => {
  await loadDefaultSession(page);
  const textarea = page.getByTestId('sticky-itrans-input');
  const sample = 'agniM ile purohitaM yajnasya';
  const rendered = transliterate(sample);
  const clickedWord = 'yajnasya';
  const expectedSourceWordStart = sample.indexOf(clickedWord);
  const clickedWordTargetIndex = rendered.sourceToTargetMap[expectedSourceWordStart] ?? 0;

  await textarea.fill(sample);
  await setReadAs(page, 'devanagari');

  await page.getByRole('button', { name: 'Read mode' }).click();
  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();
  await readDocument.locator(`[data-target-index="${clickedWordTargetIndex}"]`).click();

  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect(textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).resolves.toBe(expectedSourceWordStart);

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  const immersiveDocument = page.getByTestId('document-immersive-mode');
  await expect(immersiveDocument).toBeVisible();
  await immersiveDocument.locator(`[data-target-index="${clickedWordTargetIndex}"]`).click();

  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect(textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).resolves.toBe(expectedSourceWordStart);
});

test('read mode arrow keys move the selected line and highlight it', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadDefaultSession(page);

  const lines = [
    'agniM ile purohitaM',
    'yajnasya devasya',
    'hotaaram ratna-dhaatamam',
  ];

  await page.getByTestId('sticky-itrans-input').fill(lines.join('\n'));
  await setReadAs(page, 'devanagari');
  await page.getByRole('button', { name: 'Read mode' }).click();

  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();
  const firstSelected = readDocument.locator('[data-selected-read-line="true"]');
  await expect(firstSelected).toHaveCount(1);

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');

  const selectedLine = readDocument.locator('[data-selected-read-line="true"]');
  await expect(selectedLine).toHaveCount(1);
  await expect(selectedLine).toContainText(transliterate(lines[2]).unicode);
});

test('clicking read-mode compare panes jumps back into edit mode too', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const sample = 'agniM ile purohitaM yajnasya';
  const rendered = transliterate(sample);
  const clickedWord = 'yajnasya';
  const expectedSourceWordStart = sample.indexOf(clickedWord);
  const clickedWordTargetIndex = rendered.sourceToTargetMap[expectedSourceWordStart] ?? 0;

  await textarea.fill(sample);
  await setReadAs(page, 'tamil');
  await page.getByTestId('sticky-compare-chip').click();
  await page.getByTestId('sticky-compare-option-devanagari').click();

  await page.getByRole('button', { name: 'Read mode' }).click();
  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();

  const comparePane = readDocument.getByTestId('document-read-compare-pane');
  await comparePane.locator(`[data-target-index="${clickedWordTargetIndex}"]`).click();

  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect(textarea.evaluate((node: HTMLTextAreaElement) => node.selectionStart)).resolves.toBe(expectedSourceWordStart);
});

test('clicking deep read text reactivates editing on the targeted document region', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await loadDefaultSession(page);

  const seedBlocks = [
    'तैत्तिरीयारण्यके प्रथमप्रश्नप्रारम्भः ।। हरिः ओम् ।।',
    'तैत्तिरीयारण्यके द्वितीयप्रश्नप्रारम्भः । हरिः ओम् ।',
    '।। तैत्तिरीयारण्यके तृतीयप्रश्न-प्रारंभः ।। हरिः ओम् ।',
    '।। चतुर्थःप्रश्नःप्रारंभः ।। सन्त्वा सिञ्चामि यजुषा प्रजामायुर्धनञ्च ओम् शान्तिश्शान्तिश्शन्तिः',
    '।। तैत्तिरीयीरण्यके पञ्चमप्रश्नः प्रारंभः ।।  ।। तैत्तिरीयोपनिषत् ।।',
    'तैत्तिरीयारण्यके षष्ठप्रश्नप्रारम्भः । तैत्तिरीयोपनिषत् (- महानारायणोपनिषत्)',
    'अ॒र्य॒म्णो वा ए॒तन्नक्ष॑त्त्रम् । यत्पूर्वे॒ फल्गु॑नी । अ॒र्य॒मेति॒ तमा॑हु॒र्यो ददा॑ति । दान॑कामा अस्मै प्र॒जा भ॑वन्ति ।',
    'य का॒मये॑त भ॒गी स्या॒मिति॑ । स उत्त॑रयो॒ फल्गु॑न्योर॒ग्निमाद॑धीत । भग॑स्य॒ वा ए॒तन्नक्ष॑त्त्रम् । यदुत्त॑रे॒ फल्गु॑नी ।'
  ];
  const multiBlockDevanagari = Array.from({ length: 3 }, (_, index) =>
    seedBlocks.map((line) => `${line} ${index + 1}`)
  ).flat().join('\n');

  await pasteText(page, multiBlockDevanagari);
  await setReadAs(page, 'devanagari');
  await page.getByRole('button', { name: 'Read mode' }).click();

  const readContainer = page.getByTestId('main-document-scroll-container');
  const readDocument = page.getByTestId('document-read-mode');
  await expect(readDocument).toBeVisible();
  await readContainer.evaluate((node) => {
    const container = node as HTMLDivElement;
    container.scrollTop = container.scrollHeight;
  });

  const lastReadBlock = readDocument.locator('[data-testid^="document-read-block-"]').last();
  await lastReadBlock.locator('[data-target-index]').nth(12).click();

  await expect(page.getByTestId('sticky-composer-shell')).toBeVisible();
  await expect.poll(async () => {
    return page.getByTestId('sticky-itrans-input').evaluate((node: HTMLTextAreaElement) => {
      return {
        selectionStart: node.selectionStart,
        valueLength: node.value.length,
      };
    });
  }).toMatchObject({
    selectionStart: expect.any(Number),
    valueLength: expect.any(Number),
  });

  const composerState = await page.getByTestId('sticky-itrans-input').evaluate((node: HTMLTextAreaElement) => {
    return {
      selectionStart: node.selectionStart,
      valueLength: node.value.length,
    };
  });

  expect(composerState.selectionStart).toBeGreaterThan(0);
  expect(composerState.valueLength).toBeGreaterThan(0);
});

test('reference quick shortcuts keep ZWJ and ZWNJ without the old join controls header', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByRole('button', { name: 'Reference' }).click();
  await expect(page.getByText('^z').first()).toBeVisible();
  await expect(page.getByText('^Z').first()).toBeVisible();
});

test('sticky composer stays bounded for long input', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  const shell = page.getByTestId('sticky-composer-shell');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');
  const hud = page.getByTestId('sticky-shortcut-hud');

  const longInput = Array.from({ length: 90 }, (_, index) => `agniM ile purohitaM line ${index + 1}`).join('\n');
  await textarea.fill(longInput);

  const metrics = await Promise.all([
    shell.evaluate((node) => {
      const el = node as HTMLDivElement;
      return {
        height: el.clientHeight,
        viewportHeight: window.innerHeight,
      };
    }),
    textarea.evaluate((node) => {
      const el = node as HTMLTextAreaElement;
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
      };
    }),
    preview.evaluate((node) => {
      const el = node as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      return {
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        bottom: rect.bottom,
      };
    }),
    hud.evaluate((node) => {
      const el = node as HTMLDivElement;
      const rect = el.getBoundingClientRect();
      return {
        clientHeight: el.clientHeight,
        top: rect.top,
      };
    }),
  ]);

  expect(metrics[0].height).toBeLessThan(metrics[0].viewportHeight * 0.7);
  expect(metrics[1].scrollHeight).toBeGreaterThan(metrics[1].clientHeight);
  expect(metrics[2].scrollHeight).toBeGreaterThan(metrics[2].clientHeight);
  expect(metrics[3].clientHeight).toBeGreaterThan(0);
  expect(metrics[2].bottom).toBeLessThanOrEqual(metrics[3].top);
});

test('devanagari preview exposes interactive mapping markers when it is the primary script', async ({ page }) => {
  await loadDefaultSession(page);

  const sample = 'agniM ile';
  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill(sample);
  await textarea.press('End');

  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');
  await expect(preview.getByTestId('preview-caret')).toBeVisible();
  await expect(preview.locator('[data-current-word="true"]').first()).toBeVisible();
  await expect(preview.locator('[data-target-index]')).toHaveCount(transliterate(sample).unicode.length);
});

test('itrans keyboard selection expands visibly beyond one character', async ({ page }) => {
  await loadDefaultSession(page);

  const sample = 'agniM ile purohitaM';
  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill(sample);
  await textarea.click();
  await textarea.press('End');
  await textarea.press('Shift+ArrowLeft');
  await textarea.press('Shift+ArrowLeft');
  await textarea.press('Shift+ArrowLeft');

  const selection = await textarea.evaluate((node: HTMLTextAreaElement) => ({
    start: node.selectionStart,
    end: node.selectionEnd,
    selectedText: node.value.slice(node.selectionStart, node.selectionEnd),
  }));

  expect(selection.end - selection.start).toBe(3);
  expect(selection.selectedText).toBe('taM');
  await expect(page.locator('[data-source-selection="true"]').first()).toBeVisible();
  const selectedFragmentsText = await page
    .locator('[data-source-selection="true"]')
    .evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '').join(''));
  expect(selectedFragmentsText).toBe('taM');
});

test('review composer keeps itrans and devanagari scroll positions synchronized for long text', async ({ page }) => {
  await loadDefaultSession(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');
  await textarea.fill(`${LONG_SNIPPET}\n${LONG_SNIPPET}`);
  await textarea.click();
  await textarea.press('End');

  await textarea.evaluate((node) => {
    const el = node as HTMLTextAreaElement;
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  await expect
    .poll(async () => {
      const [sourceMetrics, previewMetrics, anchorMetrics] = await Promise.all([
        textarea.evaluate((node) => {
          const el = node as HTMLTextAreaElement;
          const range = Math.max(1, el.scrollHeight - el.clientHeight);
          return {
            scrollTop: el.scrollTop,
            progress: el.scrollTop / range,
          };
        }),
        preview.evaluate((node) => {
          const el = node as HTMLDivElement;
          const range = Math.max(1, el.scrollHeight - el.clientHeight);
          return {
            scrollTop: el.scrollTop,
            progress: el.scrollTop / range,
            textLength: el.innerText.trim().length,
          };
        }),
        preview.locator('[data-current-word="true"]').first().evaluate((node) => {
          const anchorRect = (node as HTMLElement).getBoundingClientRect();
          const containerRect = ((node as HTMLElement).closest('[data-testid="sticky-preview-primary-pane"]') as HTMLElement).getBoundingClientRect();
          return {
            anchorTop: anchorRect.top,
            anchorBottom: anchorRect.bottom,
            containerTop: containerRect.top,
            containerBottom: containerRect.bottom,
          };
        }),
      ]);

      return (
        sourceMetrics.scrollTop > 0 &&
        previewMetrics.scrollTop > 0 &&
        previewMetrics.textLength > 0 &&
        Math.abs(sourceMetrics.progress - previewMetrics.progress) < 0.25 &&
        anchorMetrics.anchorTop >= anchorMetrics.containerTop + 4 &&
        anchorMetrics.anchorBottom <= anchorMetrics.containerBottom - 4
      );
    })
    .toBe(true);
});

test('display settings switch composer layout and keep composer and document typography independent', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);

  const shell = page.getByTestId('sticky-composer-shell');
  await expect(shell).toHaveAttribute('data-layout', 'side-by-side');

  await page.getByRole('button', { name: 'Stacked' }).click();
  await expect(shell).toHaveAttribute('data-layout', 'stacked');

  const composerInput = page.getByTestId('sticky-itrans-input');
  await setReadAs(page, 'devanagari');
  const preview = page.getByTestId('sticky-preview-primary-pane');

  await setRangeValue(page, 'ITRANS Size', '26');
  await setRangeValue(page, 'Devanagari Size', '42');
  await setRangeValue(page, 'Document Devanagari Size', '22');

  await composerInput.fill('agniM ile purohitaM\naayaahi viitaye');
  await page.getByRole('button', { name: 'Read mode' }).click();

  const fontSizes = await Promise.all([
    composerInput.evaluate((node) => window.getComputedStyle(node).fontSize),
    preview.evaluate((node) => window.getComputedStyle(node).fontSize),
    page.getByTestId('document-read-mode').evaluate((node) => window.getComputedStyle(node).fontSize),
  ]);

  expect(fontSizes[0]).toBe('26px');
  expect(fontSizes[1]).toBe('42px');
  expect(fontSizes[2]).toBe('22px');
});

test('prediction layout options render the suggestion tray in different positions', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');

  await page.getByRole('button', { name: 'Inline' }).click();
  await expect(page.getByTestId('word-predictions-inline')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-footer')).toHaveCount(0);

  await page.getByRole('button', { name: 'Split' }).click();
  await expect(page.getByTestId('word-predictions-split')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-inline')).toHaveCount(0);

  await page.getByRole('button', { name: 'Footer' }).click();
  await expect(page.getByTestId('word-predictions-footer')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-split')).toHaveCount(0);

  await page.getByRole('button', { name: 'Listbox' }).click();
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('word-predictions-footer')).toHaveCount(0);
});

test('listbox prediction mode supports number key shortcuts (1-7)', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Listbox' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });

  await textarea.press('1');

  const value = await textarea.inputValue();
  expect(value.length).toBeGreaterThan(2);
  expect(value.startsWith('ga')).toBeTruthy();
  await expect(page.getByTestId('word-predictions-listbox')).toHaveCount(0);
});

test('listbox prediction mode supports arrow navigation and enter accept', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Listbox' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });

  await textarea.press('ArrowDown');
  await textarea.press('Enter');

  const value = await textarea.inputValue();
  expect(value.length).toBeGreaterThan(2);
  expect(value.startsWith('ga')).toBeTruthy();
  await expect(page.getByTestId('word-predictions-listbox')).toHaveCount(0);
});

test('floating listbox auto-hides after the configured timeout', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Listbox' }).click();
  await setRangeValue(page, 'Prediction Popup Timeout', '3');

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });

  await page.waitForTimeout(3300);
  await expect(page.getByTestId('word-predictions-listbox')).toHaveCount(0);
});

test('predictions update from the word at the active caret, not only the end of the block', async ({ page }) => {
  await loadDefaultSession(page);

  await openDisplaySettings(page);
  await page.getByRole('button', { name: 'Listbox' }).click();

  const textarea = page.getByTestId('sticky-itrans-input');
  await textarea.fill('agniM ile soma');
  await textarea.evaluate((node: HTMLTextAreaElement) => {
    node.focus();
    node.setSelectionRange(10, 10);
    node.dispatchEvent(new Event('select', { bubbles: true }));
  });

  await page.keyboard.type('ga');
  await expect(page.getByTestId('word-predictions-listbox')).toBeVisible({ timeout: 10000 });
});
