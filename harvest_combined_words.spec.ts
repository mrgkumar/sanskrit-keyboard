import { test } from '@playwright/test';
import fs from 'fs';

test('harvest words and frequencies from combined links', async ({ browser }) => {
    // Increase test timeout to 10 minutes
    test.setTimeout(600000);
    
    const links = JSON.parse(fs.readFileSync('combined_links.json', 'utf8'));
    console.log(`Processing ${links.length} links...`);

    const wordCounts = new Map<string, number>();
    const batchSize = 5; // Smaller batch size to avoid overwhelming or timeouts

    for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(links.length / batchSize)}...`);
        
        await Promise.all(batch.map(async (link) => {
            const context = await browser.newContext();
            const page = await context.newPage();
            try {
                await page.route('**/*.{png,jpg,jpeg,css,svg,woff,woff2}', route => route.abort());
                // 60s per page
                await page.goto(link.href, { timeout: 60000, waitUntil: 'domcontentloaded' });
                
                const text = await page.evaluate(() => document.body.innerText);
                const words = text.match(/[\u0900-\u097F\u1CD0-\u1CFF]+/g);
                if (words) {
                    words.forEach(w => {
                        if (w.length > 1) {
                            wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
                        }
                    });
                }
            } catch (err) {
                console.error(`Error processing ${link.href}:`, err.message);
            } finally {
                await context.close();
            }
        }));
    }

    const sortedWords = Array.from(wordCounts.entries())
        .sort((a, b) => b[1] - a[1]);

    console.log(`Total unique words found: ${sortedWords.length}`);

    const output = sortedWords.map(([word, count], idx) => JSON.stringify({
        unique_identifier: `harv_${idx + 1}`,
        "native word": word,
        source: "vignanam_combined",
        score: count
    })).join('\n');

    fs.writeFileSync('harvested_combined_words.jsonl', output);
    console.log('Saved to harvested_combined_words.jsonl');
});
