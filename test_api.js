// Test API endpoint directly
async function testAPI() {
    console.log('Testing /api/rentals/contracts...\n');

    try {
        const res = await fetch('http://localhost:3000/api/rentals/contracts');
        const data = await res.json();

        console.log('Status:', res.status);
        console.log('Response:', JSON.stringify(data, null, 2));

        if (!res.ok) {
            console.error('\n❌ API returned error');
        } else if (Array.isArray(data)) {
            console.log(`\n✅ API returned array with ${data.length} contracts`);
        } else {
            console.log('\n⚠️ API returned non-array:', data);
        }
    } catch (error) {
        console.error('❌ Fetch error:', error.message);
    }
}

testAPI();
