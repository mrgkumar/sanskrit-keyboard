import fs from 'fs';
import readline from 'readline';
import { detransliterate } from '../src/lib/vedic/utils.ts';

async function main() {
    const inputPath = 'harvested_combined_words.jsonl';
    const outputPath = 'harvested_itrans_corpus.jsonl';
    
    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return;
    }

    const fileStream = fs.createReadStream(inputPath);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(outputPath);
    let count = 0;

    console.log('Starting detransliteration of harvested corpus...');

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            const devanagari = entry['native word'];
            const score = entry['score'];
            
            // Convert Devanagari to ITRANS using the project's utility
            const itrans = detransliterate(devanagari);
            
            const newEntry = {
                unique_identifier: entry.unique_identifier,
                "native word": devanagari,
                "english word": itrans, // ITRANS in the "english word" field as per project convention
                source: entry.source,
                score: score
            };
            
            outputStream.write(JSON.stringify(newEntry) + '\n');
            count++;
            
            if (count % 5000 === 0) {
                console.log(`Processed ${count} words...`);
            }
        } catch (err) {
            console.error('Error parsing line:', line, err);
        }
    }

    outputStream.end();
    console.log(`Detransliteration complete. Processed ${count} words.`);
    console.log(`Results saved to ${outputPath}`);
}

main().catch(console.error);
