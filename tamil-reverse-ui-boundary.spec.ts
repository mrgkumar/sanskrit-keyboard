import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

const readSource = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8');

const collectSourceFiles = (relativeDir: string): string[] => {
  const absoluteDir = join(process.cwd(), relativeDir);

  return readdirSync(absoluteDir).flatMap((entry) => {
    const relativePath = join(relativeDir, entry);
    const absolutePath = join(process.cwd(), relativePath);

    if (statSync(absolutePath).isDirectory()) {
      return collectSourceFiles(relativePath);
    }

    if (/\.(ts|tsx)$/u.test(entry)) {
      return [relativePath];
    }

    return [];
  });
};

test('Gate 6 does not expose a generic Tamil reverse entry point or claim general Tamil input support', () => {
  const shippedUiSources = [
    ...collectSourceFiles('src/app'),
    ...collectSourceFiles('src/components'),
    'src/lib/vedic/mapping.ts',
  ].map(readSource).join('\n');

  expect(shippedUiSources).not.toMatch(/Tamil reverse/i);
  expect(shippedUiSources).not.toMatch(/Reverse Tamil/i);
  expect(shippedUiSources).not.toMatch(/Tamil input supported/i);
  expect(shippedUiSources).not.toMatch(/generic Tamil input/i);
});

test('Gate 6 keeps Tamil read mode explicitly gated away from exact cursor-linked navigation', () => {
  const stickyComposerSource = readSource('src/components/StickyTopComposer.tsx');

  expect(stickyComposerSource).toContain('Tamil preview is read-only. Cursor-linked navigation and highlight stay Devanagari-only.');
});

test('Tamil Precision recovery copy stays bounded to precision-only input and honest rejection language', () => {
  const engineSource = readSource('src/components/engine/TransliterationEngine.tsx');

  expect(engineSource).toContain('Tamil Precision Recovery');
  expect(engineSource).toContain('Utility');
  expect(engineSource).toContain(
    'Phase 1 utility: recovers Roman Sanskrit only from frozen Tamil Precision input. Plain Tamil and Baraha Tamil reject instead of guessing.',
  );
  expect(engineSource).toContain('Derived Baraha Roman');
  expect(engineSource).toContain('Derived from the canonical recovery result. It is not a separate Tamil parser mode.');
  expect(engineSource).toContain('Rejected Source');
  expect(engineSource).not.toMatch(/supports generic Tamil input/i);
});
