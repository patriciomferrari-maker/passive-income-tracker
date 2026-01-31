import { checkABLWhatsAppDirect } from '../lib/scrapers/abl-whatsapp-direct';

// Partida from user screenshot
const PARTIDA = '3786683';

async function test() {
    console.log('🧪 Testing ABL WhatsApp Integration...');
    try {
        const result = await checkABLWhatsAppDirect(PARTIDA);
        console.log('\nFINAL RESULT:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

test();
