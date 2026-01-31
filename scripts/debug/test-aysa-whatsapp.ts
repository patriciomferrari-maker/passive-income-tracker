import { checkAysaWhatsApp } from '../lib/scrapers/aysa-whatsapp';

async function testAysaWhatsApp() {
    console.log('📱 Testing AYSA WhatsApp scraper...\n');

    // Replace with a real AYSA account number for testing
    try {
        const result = await checkAysaWhatsApp('YOUR_AYSA_ACCOUNT_NUMBER');

        console.log('\n✅ Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n❌ Error:', error);
    }

    process.exit(0);
}

testAysaWhatsApp();
