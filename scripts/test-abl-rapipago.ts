
import { checkABLCABA } from '../lib/scrapers/abl-caba';

async function testABL() {
    const partida = '3786683'; // Real partida from DB
    console.log('🚀 Testing ABL CABA (Rapipago)...');
    const result = await checkABLCABA(partida);
    console.log('\n--- Result ---');
    console.log(JSON.stringify(result, null, 2));
}

testABL().catch(e => console.error(e));
