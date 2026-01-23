
import { checkNaturgyRapipago } from '../lib/scrapers/naturgy-rapipago';

async function main() {
    const barcode = process.argv[2] || '32910271685513524055282506027012600015596344';
    console.log(`\n🧪 STANDALONE NATURGY TEST`);
    console.log(`📋 Barcode: ${barcode}\n`);

    try {
        const result = await checkNaturgyRapipago(barcode);
        console.log('\n--- TEST RESULT ---');
        console.log(JSON.stringify(result, null, 2));

        if (result.status === 'ERROR') {
            console.log('\n❌ Test failed. Check brain/naturgy_error_standalone.png for a screenshot of the failure.');
        } else {
            console.log('\n✅ Test completed successfully!');
        }
    } catch (err: any) {
        console.error('\n💥 Unexpected error during test:', err.message);
    }
}

main();
