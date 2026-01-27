
// @ts-nocheck
import { checkABLRapipago } from '../lib/scrapers/abl-rapipago.js';
import { checkNaturgyRapipago } from '../lib/scrapers/naturgy-rapipago.js';

async function testBothScrapers() {
    console.log('='.repeat(60));
    console.log('🧪 Testing Both Rapipago Scrapers');
    console.log('='.repeat(60));

    // Test 1: ABL CABA
    console.log('\n📋 Test 1: ABL CABA');
    console.log('-'.repeat(60));
    try {
        const ablResult = await checkABLRapipago('3786683');
        console.log('✅ ABL Result:', JSON.stringify(ablResult, null, 2));
    } catch (error) {
        console.error('❌ ABL Error:', error.message);
    }

    // Wait between tests to avoid rate limiting
    console.log('\n⏳ Waiting 5 seconds before next test...\n');
    await new Promise(r => setTimeout(r, 5000));

    // Test 2: Naturgy
    console.log('📋 Test 2: Naturgy');
    console.log('-'.repeat(60));
    try {
        const naturgyResult = await checkNaturgyRapipago('32910271685513524055282506027012600015596344');
        console.log('✅ Naturgy Result:', JSON.stringify(naturgyResult, null, 2));
    } catch (error) {
        console.error('❌ Naturgy Error:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests completed!');
    console.log('='.repeat(60));
}

testBothScrapers().catch(console.error);
