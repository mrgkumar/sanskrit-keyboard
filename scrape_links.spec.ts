import { test } from '@playwright/test';
import fs from 'fs';

test('harvest veda mantra links', async ({ page }) => {
    await page.goto('https://vignanam.org/devanagari.html');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    const allLinks = await page.$$eval('a', anchors => 
        anchors.map((a, i) => ({ 
            idx: i,
            text: (a as HTMLAnchorElement).innerText.replace(/\s+/g, ' ').trim(), 
            href: (a as HTMLAnchorElement).href 
        }))
    );

    // Veda Mantras header is typically "वेद मन्त्राः (87)"
    const vedaHeaderIdx = allLinks.findIndex(l => l.text.includes('वेद मन्त्राः'));
    let vedaLinks: any[] = [];
    if (vedaHeaderIdx !== -1) {
        console.log(`Found Veda header at index ${vedaHeaderIdx}: ${allLinks[vedaHeaderIdx].text}`);
        // The list count is 87, but user's list might be longer/shorter. 
        // We'll take 90 to be safe and filter later if needed.
        vedaLinks = allLinks.slice(vedaHeaderIdx + 1, vedaHeaderIdx + 95);
    }

    // Combine with previous if they exist, or just save these for now
    fs.writeFileSync('veda_links.json', JSON.stringify(vedaLinks, null, 2));
    console.log(`Saved ${vedaLinks.length} Veda links to veda_links.json`);
});
