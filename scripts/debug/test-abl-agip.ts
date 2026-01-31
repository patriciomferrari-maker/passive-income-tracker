
import { checkABLAGIP } from '../lib/scrapers/abl-agip';

async function main() {
    const partida = process.argv[2] || '3786683';
    const dv = process.argv[3]; // Optional

    console.log(`Running Direct AGIP check for ${partida}...`);
    const result = await checkABLAGIP(partida, dv);
    console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
