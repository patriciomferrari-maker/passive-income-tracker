const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const pdfPath = 'C:\\Users\\patri\\.gemini\\antigravity\\Resumenes\\Diciembre 25.pdf';

console.log(`Reading file: ${pdfPath}`);

if (!fs.existsSync(pdfPath)) {
    console.error('File not found!');
    process.exit(1);
}

const dataBuffer = fs.readFileSync(pdfPath);

pdf(dataBuffer).then(function (data) {
    console.log('--- START RAW TEXT ANALYSIS ---');
    const lines = data.text.split('\n');
    const keywords = ['BENSIMON', 'NATURGY', 'CERINI', 'MERPAGO', 'RACING'];

    let matchCount = 0;
    lines.forEach((line, index) => {
        if (keywords.some(k => line.includes(k))) {
            matchCount++;
            console.log(`[MATCH FOUND line ${index}]: ${line}`);
            // Print surrounding lines for context
            console.log(`   Preuious: ${lines[index - 1] || ''}`);
            console.log(`   Next:     ${lines[index + 1] || ''}`);
            console.log('------------------------------------------------');
        }
    });

    if (matchCount === 0) {
        console.log('No matches found for keywords.');
        // If no matches, maybe print the first 100 lines to see what's going on
        console.log('--- FIRST 50 LINES ---');
        lines.slice(0, 50).forEach((l, i) => console.log(`${i}: ${l}`));
    }

    console.log('--- END RAW TEXT ANALYSIS ---');
}).catch(err => {
    console.error('Error parsing PDF:', err);
});
