import { checkNaturgy } from '../lib/scrapers/naturgy';

// Test with a Naturgy account number
// Replace with actual account number
const ACCOUNT_NUMBER = process.argv[2] || '';

async function test() {
    if (!ACCOUNT_NUMBER) {
        console.error('❌ Please provide a Naturgy account number:');
        console.error('   npx ts-node --project tsconfig.script.json scripts/test-naturgy.ts <ACCOUNT_NUMBER>');
        process.exit(1);
    }

    console.log('🧪 Testing Naturgy Integration...');
    console.log(`Account: ${ACCOUNT_NUMBER}\n`);

    try {
        const result = await checkNaturgy(ACCOUNT_NUMBER);
        console.log('\n✅ RESULT:', JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

test();
