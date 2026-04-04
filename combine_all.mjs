import fs from 'fs';

// Load all harvested link files
const veda = JSON.parse(fs.readFileSync('veda_links.json', 'utf8'));
const others = JSON.parse(fs.readFileSync('combined_links.json', 'utf8'));

const allLinks = [...veda, ...others];

// Deduplicate by href
const uniqueLinks = [];
const seen = new Set();
for (const link of allLinks) {
    if (!seen.has(link.href)) {
        uniqueLinks.push(link);
        seen.add(link.href);
    }
}

fs.writeFileSync('combined_links.json', JSON.stringify(uniqueLinks, null, 2));
console.log(`Saved ${uniqueLinks.length} unique links to combined_links.json`);
