
import PDFParser from 'pdf2json';

async function main() {
    console.log('Attempting to instantiate PDFParser...');
    try {
        const parser = new PDFParser();
        console.log('PDFParser instantiated successfully.');

        // Mock buffer (empty PDF-like signature to not crash immediately on empty)
        // Actually PDFParser expects a buffer.
        // Let's just check instantiation first, that's the most likely crash point if import is wrong.

        console.log('Test Passed');
    } catch (error) {
        console.error('CRASHED:', error);
    }
}

main();
