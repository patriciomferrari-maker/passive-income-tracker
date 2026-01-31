
import { checkABLWhatsApp } from '../lib/scrapers/abl-whatsapp';

async function main() {
    const partida = process.argv[2] || '3786683';

    console.log(`Running WhatsApp Boti check for partida: ${partida}...`);
    console.log('NOTE: If this is the first time, you will need to scan the QR code below.');

    try {
        const result = await checkABLWhatsApp(partida);
        console.log('Final Result:', JSON.stringify(result, null, 2));
    } catch (err) {
        console.error('Fatal Test Error:', err);
    }
}

main().catch(console.error);
