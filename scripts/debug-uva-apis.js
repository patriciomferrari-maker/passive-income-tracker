// Debug script to test UVA chart API endpoints
const fetch = require('node-fetch');

async function testAPIs() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing UVA Chart APIs...\n');

    // Test 1: UVA data
    console.log('1. Testing /api/economic-data/uva');
    try {
        const res1 = await fetch(`${baseUrl}/api/economic-data/uva`);
        const data1 = await res1.json();
        console.log(`   Response type: ${Array.isArray(data1) ? 'Array' : typeof data1}`);
        console.log(`   Count: ${Array.isArray(data1) ? data1.length : 'N/A'}`);
        console.log(`   Sample:`, data1.slice(0, 2));
    } catch (err) {
        console.error('   Error:', err.message);
    }

    // Test 2: IPC data
    console.log('\n2. Testing /api/admin/inflation');
    try {
        const res2 = await fetch(`${baseUrl}/api/admin/inflation`);
        const data2 = await res2.json();
        console.log(`   Response type: ${Array.isArray(data2) ? 'Array' : typeof data2}`);
        console.log(`   Count: ${Array.isArray(data2) ? data2.length : 'N/A'}`);
        console.log(`   Sample:`, data2.slice(0, 2));
    } catch (err) {
        console.error('   Error:', err.message);
    }

    // Test 3: TC Blue
    console.log('\n3. Testing /api/admin/economic');
    try {
        const res3 = await fetch(`${baseUrl}/api/admin/economic`);
        const data3 = await res3.json();
        console.log(`   Response type: ${Array.isArray(data3) ? 'Array' : typeof data3}`);
        console.log(`   Count: ${Array.isArray(data3) ? data3.length : 'N/A'}`);
        console.log(`   Sample:`, data3.slice(0, 2));
    } catch (err) {
        console.error('   Error:', err.message);
    }

    // Test 4: TC Oficial
    console.log('\n4. Testing /api/economic-data/tc-oficial');
    try {
        const res4 = await fetch(`${baseUrl}/api/economic-data/tc-oficial`);
        const data4 = await res4.json();
        console.log(`   Response type: ${Array.isArray(data4) ? 'Array' : typeof data4}`);
        console.log(`   Count: ${Array.isArray(data4) ? data4.length : 'N/A'}`);
        console.log(`   Sample:`, data4.slice(0, 2));
    } catch (err) {
        console.error('   Error:', err.message);
    }
}

testAPIs().catch(console.error);
