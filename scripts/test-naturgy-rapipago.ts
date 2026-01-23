
import { checkNaturgyRapipago } from '../lib/scrapers/naturgy-rapipago';

async function test() {
    const code = process.argv[2] || 'TEST_CODE';
    console.log(`🧪 Testing Naturgy Rapipago with code: ${code}`);

    const result = await checkNaturgyRapipago(code);
    console.log('\n✅ FINAL RESULT:', JSON.stringify(result, null, 2));
}

test().catch(console.error);
