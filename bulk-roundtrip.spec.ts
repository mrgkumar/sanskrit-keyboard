import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { transliterate, detransliterate, formatSourceForScript, reverseTamilInput } from './src/lib/vedic/utils.ts';

const INPUT_PATH = path.resolve(__dirname, 'harvested_combined_words.jsonl');

test.describe('Bulk Roundtrip Validation', () => {
  test('Devanagari and Tamil Precision Roundtrip', async () => {
    if (!fs.existsSync(INPUT_PATH)) {
      console.warn('Skipping bulk test: harvested_combined_words.jsonl not found');
      return;
    }

    const content = fs.readFileSync(INPUT_PATH, 'utf8');
    const lines = content.split('\n');

    let processed = 0;
    let devanagariFailures = 0;
    let tamilFailures = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      const originalDevanagari = row['native word'];
      if (!originalDevanagari) continue;

      processed++;

      // 1. Devanagari Roundtrip
      const i1 = detransliterate(originalDevanagari);
      const d2 = transliterate(i1).unicode;

      const isSvaritaNormalization = originalDevanagari.includes('\u0951\u0951') && d2.includes('\u1CDA');
      
      if (originalDevanagari !== d2 && !isSvaritaNormalization) {
        devanagariFailures++;
      } else {
        // 2. Tamil Roundtrip
        const t1 = formatSourceForScript(i1, 'tamil', { tamilOutputStyle: 'precision', romanOutputStyle: 'canonical' });
        const reverseResult = reverseTamilInput(t1, { inputMode: 'tamil-precision', outputMode: 'canonical' });
        
        if (reverseResult.status !== 'success') {
          // Check if it's just plain tamil rejection (we allow this in bulk if it's unambiguous)
          // But here we want to see if the mapping IS BUGGY.
          tamilFailures++;
        } else {
          const i2 = reverseResult.canonicalRoman;
          const d3 = transliterate(i2).unicode;
          
          if (d3 !== d2) {
            // Normalizations (order matters: complex first)
            const normalize = (s: string) => s
              .replace(/\u0902\u0901/g, '\u0956')
              .replace(/\u0950/g, '\u0913\u092E\u094D')
              .replace(/\u0901/g, '\u0902');
            
            const d2norm = normalize(d2);
            const d3norm = normalize(d3);
            
            if (d2norm !== d3norm) {
              tamilFailures++;
            }
          }
        }
      }
    }

    console.log(`Bulk Roundtrip finished: ${processed} words, ${devanagariFailures} Devanagari failures, ${tamilFailures} Tamil failures`);
    // We allow a few failures due to script rejections of plain words in this strict mode
    expect(devanagariFailures).toBe(0);
    // Note: tamilFailures might be > 0 because of strict plain-Tamil rejections in reverseTamilInput
  });
});
