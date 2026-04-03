import { expect, test, type Page } from '@playwright/test';

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000';
const SESSION_INDEX_KEY = 'sanskrit-keyboard.session-index.v2';
const SESSION_SNAPSHOT_PREFIX = 'sanskrit-keyboard.session.v2.';
const STORAGE_KEYS_TO_CLEAR = [
  'sanskrit-keyboard.sessions.v1',
  'sanskrit-keyboard.session-index.v2',
  'sanskrit-keyboard.lexical-history.v1',
];

const clearStorage = async (page: Page) => {
  await page.addInitScript((keys) => {
    window.localStorage.clear();
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
    Object.keys(window.localStorage)
      .filter((key) => key.startsWith('sanskrit-keyboard.session.v2.'))
      .forEach((key) => window.localStorage.removeItem(key));
  }, STORAGE_KEYS_TO_CLEAR);
};

const loadDefaultSession = async (page: Page, options?: { allowPreexistingValue?: boolean }) => {
  await clearStorage(page);
  await page.goto(APP_URL);
  page.on('dialog', (dialog) => dialog.accept());
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
  await page.getByRole('button', { name: 'Workspace' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  const textarea = page.getByTestId('sticky-itrans-input');
  if (options?.allowPreexistingValue) {
    await textarea.fill('');
  } else {
    await expect(textarea).toHaveValue('');
  }
};

const seedLegacyOutputSession = async (page: Page, outputScheme: 'canonical-vedic' | 'baraha-compatible' | 'sanskrit-tamil-precision') => {
  const sessionId = 'legacy-output-session';
  const updatedAt = '2026-04-02T12:00:00.000Z';
  await page.addInitScript(
    ({ snapshotKey, sessionIndexKey, sessionId: seededSessionId, seededUpdatedAt, seededOutputScheme }) => {
      window.localStorage.clear();
      const snapshot = {
        sessionId: seededSessionId,
        sessionName: 'Legacy Output Session',
        blocks: [
          {
            id: 'block-1',
            type: 'short',
            source: 'agniM',
            rendered: 'अग्निं',
          },
        ],
        editorState: {
          activeBlockId: 'block-1',
          activeAnchorSegmentIndex: 0,
          focusSpan: 'balanced',
          viewMode: 'read',
          ghostAssistEnabled: true,
        },
        displaySettings: {
          outputScheme: seededOutputScheme,
        },
        updatedAt: seededUpdatedAt,
      };

      window.localStorage.setItem(
        sessionIndexKey,
        JSON.stringify([
          {
            sessionId: seededSessionId,
            sessionName: 'Legacy Output Session',
            updatedAt: seededUpdatedAt,
          },
        ]),
      );
      window.localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
    },
    {
      snapshotKey: `${SESSION_SNAPSHOT_PREFIX}${sessionId}`,
      sessionIndexKey: SESSION_INDEX_KEY,
      sessionId,
      seededUpdatedAt: updatedAt,
      seededOutputScheme: outputScheme,
    },
  );
  await page.goto(APP_URL);
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();
};

const openWorkspace = async (page: Page) => {
  await page.getByRole('button', { name: 'Workspace' }).click();
  await expect(page.getByText('Primary Script')).toBeVisible();
};

const setReadAs = async (page: Page, script: 'roman' | 'devanagari' | 'tamil') => {
  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId(`sticky-read-as-option-${script}`).click({ force: true });
};

const setCompareWith = async (page: Page, script: 'off' | 'roman' | 'devanagari' | 'tamil') => {
  await page.getByTestId('sticky-compare-chip').click();
  await page.getByTestId(`sticky-compare-option-${script}`).click({ force: true });
};

test('Gate 3 workspace panel replaces Output Style with script-aware controls', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await expect(page.getByText('Primary Script')).toBeVisible();
  await expect(page.getByText('Compare With')).toBeVisible();
  await expect(page.getByTestId('workspace-roman-style')).toBeVisible();
  await expect(page.getByTestId('workspace-tamil-mode')).toHaveCount(0);
  await expect(page.getByText('Output Style')).toHaveCount(0);
  await expect(
    page.getByText('Affects source copy and export only. Canonical paste and stored editor source do not change.'),
  ).toHaveCount(0);
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
});

test('Gate 3 shows Roman Style and Tamil Mode only when their scripts are active', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await expect(page.getByTestId('workspace-roman-style')).toBeVisible();
  await expect(page.getByTestId('workspace-tamil-mode')).toHaveCount(0);

  await page.getByTestId('workspace-primary-script-tamil').click();
  await expect(page.getByText('Tamil Mode')).toBeVisible();
  await expect(page.getByTestId('workspace-roman-style')).toHaveCount(0);

  await page.getByTestId('workspace-compare-script-roman').click();
  await expect(page.getByTestId('workspace-roman-style')).toBeVisible();
  await expect(page.getByTestId('workspace-tamil-mode')).toBeVisible();
});

test('Gate 3 changing comparison leaves the primary script unchanged', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await page.getByTestId('workspace-primary-script-tamil').click();
  await expect(page.getByTestId('workspace-primary-script-tamil')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('workspace-compare-script-devanagari').click();
  await expect(page.getByTestId('workspace-compare-script-devanagari')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-primary-script-tamil')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-primary-script-roman')).toHaveAttribute('aria-pressed', 'false');
});

test('Gate 3 presents Tamil Mode as a fixed phase-1 contract', async ({ page }) => {
  await loadDefaultSession(page);
  await openWorkspace(page);

  await page.getByTestId('workspace-primary-script-tamil').click();

  const tamilModeSection = page.getByTestId('workspace-tamil-mode');
  await expect(tamilModeSection).toBeVisible();
  await expect(tamilModeSection).toContainText('Precision');
  await expect(tamilModeSection).toContainText('Phase 1 keeps Tamil in the reversible precision mode.');
  await expect(page.getByTestId('workspace-tamil-mode-precision')).toBeVisible();
});

test('Gate 3 panel reflects all migrated legacy output states', async ({ page }) => {
  await seedLegacyOutputSession(page, 'canonical-vedic');
  await openWorkspace(page);

  await expect(page.getByTestId('workspace-primary-script-roman')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-roman-style')).toBeVisible();
  await expect(page.getByTestId('workspace-roman-style-canonical')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-tamil-mode')).toHaveCount(0);

  await seedLegacyOutputSession(page, 'baraha-compatible');
  await openWorkspace(page);

  await expect(page.getByTestId('workspace-primary-script-roman')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-roman-style')).toBeVisible();
  await expect(page.getByTestId('workspace-roman-style-baraha')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-tamil-mode')).toHaveCount(0);

  await seedLegacyOutputSession(page, 'sanskrit-tamil-precision');
  await openWorkspace(page);

  await expect(page.getByTestId('workspace-primary-script-tamil')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-roman-style')).toHaveCount(0);
  await expect(page.getByTestId('workspace-tamil-mode')).toBeVisible();
});

test('Gate 4 shows Read As and Compare quick switches near Reference with default labels', async ({ page }) => {
  await loadDefaultSession(page);

  await expect(page.getByRole('button', { name: 'Reference' })).toBeVisible();
  await expect(page.getByTestId('sticky-read-as-chip')).toBeVisible();
  await expect(page.getByTestId('sticky-read-as-chip')).toContainText('Read As: Roman');
  await expect(page.getByTestId('sticky-compare-chip')).toBeVisible();
  await expect(page.getByTestId('sticky-compare-chip')).toContainText('Compare: Off');
});

test('Gate 4 Read As quick switch updates primary script and stays in sync with the workspace panel', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTestId('sticky-read-as-chip').click();
  await expect(page.getByTestId('sticky-read-as-menu')).toBeVisible();
  await page.getByTestId('sticky-read-as-option-tamil').click();

  await expect(page.getByTestId('sticky-read-as-chip')).toContainText('Read As: Tamil');
  await expect(page.getByTestId('sticky-compare-chip')).toContainText('Compare: Off');

  await openWorkspace(page);
  await expect(page.getByTestId('workspace-primary-script-tamil')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
});

test('Gate 4 Compare quick switch exposes explicit direct choices and syncs with the panel', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTestId('sticky-compare-chip').click();
  await expect(page.getByTestId('sticky-compare-menu')).toBeVisible();
  await expect(page.getByTestId('sticky-compare-option-off')).toBeVisible();
  await expect(page.getByTestId('sticky-compare-option-roman')).toBeVisible();
  await expect(page.getByTestId('sticky-compare-option-devanagari')).toBeVisible();
  await expect(page.getByTestId('sticky-compare-option-tamil')).toBeVisible();

  await page.getByTestId('sticky-compare-option-devanagari').click();
  await expect(page.getByTestId('sticky-compare-chip')).toContainText('Compare: Devanagari');
  await expect(page.getByTestId('sticky-read-as-chip')).toContainText('Read As: Roman');

  await openWorkspace(page);
  await expect(page.getByTestId('workspace-primary-script-roman')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-devanagari')).toHaveAttribute('aria-pressed', 'true');
});

test('Gate 4 Compare stays off until explicitly enabled even when Read As changes', async ({ page }) => {
  await loadDefaultSession(page);

  await page.getByTestId('sticky-read-as-chip').click();
  await page.getByTestId('sticky-read-as-option-devanagari').click();

  await expect(page.getByTestId('sticky-read-as-chip')).toContainText('Read As: Devanagari');
  await expect(page.getByTestId('sticky-compare-chip')).toContainText('Compare: Off');

  await openWorkspace(page);
  await expect(page.getByTestId('workspace-primary-script-devanagari')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('workspace-compare-script-off')).toHaveAttribute('aria-pressed', 'true');
});

test('Gate 5 keeps the composer in single-pane mode until comparison is enabled', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await setReadAs(page, 'tamil');

  await expect(page.getByTestId('sticky-preview-surface')).toHaveAttribute('data-compare-mode', 'single');
  await expect(page.getByTestId('sticky-preview-primary-pane')).toContainText('அக³்நிஂ');
  await expect(page.getByTestId('sticky-preview-compare-pane')).toHaveCount(0);
  await expect(page.getByTestId('sticky-itrans-input')).toBeVisible();

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-mode')).toHaveAttribute('data-compare-mode', 'single');
  await expect(page.getByTestId('document-read-compare-pane')).toHaveCount(0);

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toHaveAttribute('data-compare-mode', 'single');
  await expect(page.getByTestId('document-immersive-compare-pane')).toHaveCount(0);
});

test('Gate 5 composer compare mode renders distinct primary and comparison panes', async ({ page }) => {
  await loadDefaultSession(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');
  const shellLayout = await page.getByTestId('sticky-composer-shell').getAttribute('data-layout');

  await setReadAs(page, 'tamil');
  await setCompareWith(page, 'devanagari');

  await expect(page.getByTestId('sticky-preview-surface')).toHaveAttribute('data-compare-mode', 'compare');
  await expect(page.getByTestId('sticky-preview-surface')).toHaveAttribute('data-compare-layout', 'split');
  await expect(page.getByTestId('sticky-preview-primary-pane')).toContainText('அக³்நிஂ');
  await expect(page.getByTestId('sticky-preview-primary-pane')).not.toContainText('अग्निं');
  await expect(page.getByTestId('sticky-preview-compare-pane')).toContainText('अग्निं');
  await expect(page.getByTestId('sticky-preview-compare-pane')).not.toContainText('அக³்நிஂ');
  await expect(page.getByTestId('sticky-itrans-input')).toHaveValue('agniM ile purohitaM');
  await expect(page.getByTestId('sticky-composer-shell')).toHaveAttribute('data-layout', shellLayout ?? 'side-by-side');
});

test('Gate 5 read and immersive views render primary and comparison scripts separately', async ({ page }) => {
  await loadDefaultSession(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await setReadAs(page, 'tamil');
  await setCompareWith(page, 'devanagari');

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-mode')).toHaveAttribute('data-compare-mode', 'compare');
  await expect(page.getByTestId('document-read-mode')).toHaveAttribute('data-compare-layout', 'split');
  await expect(page.getByTestId('document-read-primary-pane')).toContainText('அக³்நிஂ');
  await expect(page.getByTestId('document-read-primary-pane')).not.toContainText('अग्निं');
  await expect(page.getByTestId('document-read-compare-pane')).toContainText('अग्निं');
  await expect(page.getByTestId('document-read-compare-pane')).not.toContainText('அக³்நிஂ');

  await page.getByRole('button', { name: 'Immersive mode' }).click();
  await expect(page.getByTestId('document-immersive-mode')).toHaveAttribute('data-compare-mode', 'compare');
  await expect(page.getByTestId('document-immersive-mode')).toHaveAttribute('data-compare-layout', 'split');
  await expect(page.getByTestId('document-immersive-primary-pane')).toContainText('அக³்நிஂ');
  await expect(page.getByTestId('document-immersive-compare-pane')).toContainText('अग्निं');
});

test('Gate 5 keeps exact click-to-edit mapping explicit to Devanagari primary surfaces', async ({ page }) => {
  await loadDefaultSession(page);
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await setReadAs(page, 'devanagari');
  expect(await page.getByTestId('sticky-preview-primary-pane').locator('[data-target-index]').count()).toBeGreaterThan(0);

  await setReadAs(page, 'tamil');
  await setCompareWith(page, 'devanagari');

  await expect(page.getByTestId('sticky-preview-primary-pane').locator('[data-target-index]')).toHaveCount(0);
  await expect(page.getByTestId('sticky-preview-compare-pane').locator('[data-target-index]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-primary-pane').locator('[data-target-index]')).toHaveCount(0);
  await expect(page.getByTestId('document-read-compare-pane').locator('[data-target-index]')).toHaveCount(0);
});

test('Gate 5 compare layout stacks on narrow screens instead of compressing panes horizontally', async ({ page }) => {
  await loadDefaultSession(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await page.getByTestId('sticky-itrans-input').fill('agniM ile purohitaM');

  await openWorkspace(page);
  await page.getByTestId('workspace-primary-script-tamil').click();
  await page.getByTestId('workspace-compare-script-devanagari').click();
  await page.getByRole('button', { name: 'Workspace' }).click();

  await expect(page.getByTestId('sticky-preview-surface')).toHaveAttribute('data-compare-layout', 'stacked');
  const stickyPanePositions = await Promise.all([
    page.getByTestId('sticky-preview-primary-pane').boundingBox(),
    page.getByTestId('sticky-preview-compare-pane').boundingBox(),
  ]);
  expect(stickyPanePositions[0]).not.toBeNull();
  expect(stickyPanePositions[1]).not.toBeNull();
  expect(stickyPanePositions[1]!.y).toBeGreaterThan(stickyPanePositions[0]!.y);

  await page.getByRole('button', { name: 'Read mode' }).click();
  await expect(page.getByTestId('document-read-mode')).toHaveAttribute('data-compare-layout', 'stacked');
  const documentPanePositions = await Promise.all([
    page.getByTestId('document-read-primary-pane').boundingBox(),
    page.getByTestId('document-read-compare-pane').boundingBox(),
  ]);
  expect(documentPanePositions[0]).not.toBeNull();
  expect(documentPanePositions[1]).not.toBeNull();
  expect(documentPanePositions[1]!.y).toBeGreaterThan(documentPanePositions[0]!.y);
});
