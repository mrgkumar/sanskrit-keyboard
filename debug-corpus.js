const fs = require('fs');
const path = require('path');

// Mocking required parts of the engine
// Since we want to test the actual transliterate function, we need to load it.
// However, it's a TS file with imports. Let's use a simpler approach for now to confirm the mapping logic.

const corpusPath = path.join(__dirname, 'harvested_itrans_corpus.jsonl');
const content = fs.readFileSync(corpusPath, 'utf8');
const lines = content.split('\n').filter(Boolean);

console.log(`Loaded ${lines.length} lines.`);

// Just a quick check of the first 10 entries to see if they look correct
for (let i = 0; i < 10; i++) {
  const entry = JSON.parse(lines[i]);
  console.log(`[${i+1}] ITRANS: ${entry['english word']} -> Expected: ${entry['native word']}`);
}
