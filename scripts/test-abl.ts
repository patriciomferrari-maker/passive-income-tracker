import { checkABLCABA } from '../lib/scrapers/abl-caba';
import { checkABLProvincia } from '../lib/scrapers/abl-provincia';

async function testABL() {
    console.log('🏛️  Testing ABL scrapers...\n');

    // Test CABA (Soldado)
    console.log('=== CABA (Soldado) ===');
    const cabaResult = await checkABLCABA('3786683');
    console.log('Result:', JSON.stringify(cabaResult, null, 2));
    console.log('');

    // Test Provincia (N2 3D)
    console.log('=== Provincia (N2 3D) ===');
    const provinciaResult = await checkABLProvincia('852844');
    console.log('Result:', JSON.stringify(provinciaResult, null, 2));
    console.log('');

    console.log('✅ Tests completed');
}

testABL()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
