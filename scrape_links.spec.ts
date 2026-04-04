import { test } from '@playwright/test';
import fs from 'fs';

test('harvest upanishad links', async ({ page }) => {
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

    // Upanishads header is "उपनिषदः (34)"
    const upaHeaderIdx = allLinks.findIndex(l => l.text.includes('उपनिषदः'));
    let upaLinks: any[] = [];
    if (upaHeaderIdx !== -1) {
        console.log(`Found Upanishad header at index ${upaHeaderIdx}: ${allLinks[upaHeaderIdx].text}`);
        upaLinks = allLinks.slice(upaHeaderIdx + 1, upaHeaderIdx + 36);
    }

    fs.writeFileSync('upa_links.json', JSON.stringify(upaLinks, null, 2));
    console.log(`Saved ${upaLinks.length} Upanishad links to upa_links.json`);
});
