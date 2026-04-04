import fs from 'fs';

const links = JSON.parse(fs.readFileSync('all_links_debug.json', 'utf8'));

// Find index of category
const startIndex = links.findIndex(l => l.text.includes('शिव स्तोत्राणि'));
console.log('Category "शिव स्तोत्राणि" found at index:', startIndex);

if (startIndex !== -1) {
    // The next N links (82 as mentioned) should be the Shiva stotrams
    const shivaLinks = links.slice(startIndex + 1, startIndex + 83);
    console.log('Sample Shiva links:');
    console.log(JSON.stringify(shivaLinks.slice(0, 5), null, 2));
    
    fs.writeFileSync('shiva_stotram_links.json', JSON.stringify(shivaLinks, null, 2));
} else {
    // Maybe search for all links containing "shiva" or "siva" in href
    const filtered = links.filter(l => l.href.includes('shiva') || l.href.includes('siva'));
    console.log(`Found ${filtered.length} links containing "shiva" or "siva"`);
    fs.writeFileSync('shiva_stotram_links_filtered.json', JSON.stringify(filtered, null, 2));
}
