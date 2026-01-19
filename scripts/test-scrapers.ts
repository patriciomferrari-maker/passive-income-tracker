import { checkMetrogas } from '../lib/scrapers/metrogas';
import { checkEdenor } from '../lib/scrapers/edenor';

async function testScrapers() {
    console.log('🧪 Testing Utility Scrapers\n');

    // Test Metrogas
    console.log('📋 Testing Metrogas...');
    const metrogasResult = await checkMetrogas('40000041500');
    console.log('Metrogas Result:', JSON.stringify(metrogasResult, null, 2));
    console.log('');

    // Test Edenor
    console.log('📋 Testing Edenor...');
    const edenorResult = await checkEdenor('6586154355');
    console.log('Edenor Result:', JSON.stringify(edenorResult, null, 2));
    console.log('');

    console.log('✅ Tests complete!');
}

testScrapers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
