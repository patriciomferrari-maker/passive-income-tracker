import { checkMetrogasWhatsApp } from '../lib/scrapers/metrogas-whatsapp';

async function testMetrogasWhatsApp() {
    console.log('📱 Testing Metrogas WhatsApp scraper...\n');
    console.log('⚠️  IMPORTANT: You need to scan the QR code with your phone the first time!\n');

    try {
        const result = await checkMetrogasWhatsApp('40000041500');

        console.log('\n📊 Result:');
        console.log(JSON.stringify(result, null, 2));

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
}

testMetrogasWhatsApp();
