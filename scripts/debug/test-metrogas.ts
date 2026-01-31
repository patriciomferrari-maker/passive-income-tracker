import { checkMetrogas } from '../lib/scrapers/metrogas';

async function testMetrogas() {
    console.log('🔥 Testing Metrogas scraper with Soldado account...\n');

    const result = await checkMetrogas('40000041500');

    console.log('\n📊 Result:');
    console.log(JSON.stringify(result, null, 2));
}

testMetrogas()
    .then(() => {
        console.log('\n✅ Test completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
