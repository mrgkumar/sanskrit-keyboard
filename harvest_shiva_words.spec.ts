import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('harvest words and frequencies from shiva stotrams', async ({ browser }) => {
    const links = JSON.parse(fs.readFileSync('shiva_stotrams.json', 'utf8'));
    console.log(`Processing ${links.length} links...`);

    const wordCounts = new Map<string, number>();
    const batchSize = 10; // Increase batch size for efficiency

    for (let i = 0; i < links.length; i += batchSize) {
        const batch = links.slice(i, i + batchSize);
        console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(links.length / batchSize)}...`);
        
        await Promise.all(batch.map(async (link) => {
            const context = await browser.newContext();
            const page = await context.newPage();
            try {
                // block images and css for speed
                await page.route('**/*.{png,jpg,jpeg,css,svg}', route => route.abort());
                
                await page.goto(link.href, { timeout: 45000, waitUntil: 'domcontentloaded' });
                
                const text = await page.evaluate(() => document.body.innerText);
                
                // Regex for Devanagari words
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
        .sort((a, b) => b[1] - a[1]); // Sort by frequency descending

    console.log(`Total unique words found: ${sortedWords.length}`);

    // Save as JSONL with frequency as score
    const output = sortedWords.map(([word, count], idx) => JSON.stringify({
        unique_identifier: `shiva_${idx + 1}`,
        "native word": word,
        source: "vignanam_shiva",
        score: count
    })).join('\n');

    fs.writeFileSync('harvested_shiva_words.jsonl', output);
    console.log('Saved to harvested_shiva_words.jsonl with frequencies.');
});
