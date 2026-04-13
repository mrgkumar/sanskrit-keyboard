import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { transliterate } from './src/lib/vedic/utils';

test('Harvested corpus forward transliteration (ITRANS -> Devanagari)', () => {
  test.setTimeout(120000); // 2 minutes
  const corpusPath = path.join(__dirname, 'harvested_itrans_corpus.jsonl');
  const content = fs.readFileSync(corpusPath, 'utf8');
  const lines = content.split('\n').filter(Boolean);

  // Test first 500 for efficiency
  const sample = lines.slice(0, 500);

  sample.forEach((line, i) => {
    const entry = JSON.parse(line);
    const itrans = entry['english word'];
    const expected = entry['native word'];
    
    const result = transliterate(itrans).unicode.replace(/\u200C/gu, '');
    const normalizedExpected = expected.replace(/\u200C/gu, '');
    
    expect(result, `Line ${i+1}: ${itrans} should map to ${expected}`).toBe(normalizedExpected);
  });
});
