import { checkABLRapipago } from '../lib/scrapers/abl-rapipago';

const PARTIDA = process.argv[2] || '3786683';

async function test() {
    console.log('🧪 Testing ABL Rapipago Integration...');
    console.log(`Partida: ${PARTIDA}\n`);

    try {
        const result = await checkABLRapipago(PARTIDA);
        console.log('\n✅ FINAL RESULT:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

test();
