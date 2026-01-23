
import { checkABLRapipago } from '../lib/scrapers/abl-rapipago';

async function main() {
    const partida = process.argv[2];
    if (!partida) {
        console.error('Please provide a partida number as argument');
        process.exit(1);
    }

    console.log(`Running ABL check for ${partida}...`);
    try {
        const result = await checkABLRapipago(partida);
        console.log('Result:', result);
    } catch (error) {
        console.error('Test failed:', error);
    }
}

main();
