// Test UVA API endpoint
const fetch = require('node-fetch');

async function testUVAEndpoint() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing /api/economic-data/uva endpoint...\n');

    const res = await fetch(`${baseUrl}/api/economic-data/uva`);
    const data = await res.json();

    console.log('Total records returned:', data.length);
    console.log('\nFirst 5 records:');
    data.slice(0, 5).forEach(r => console.log('  ', r.date, '=', r.value));

    console.log('\nLast 5 records:');
    data.slice(-5).forEach(r => console.log('  ', r.date, '=', r.value));

    // Check date range
    const first = data[data.length - 1]; // desc order, so last is first chronologically
    const last = data[0]; // desc order, so first is last chronologically

    console.log('\nDate range:');
    console.log('  First:', first.date);
    console.log('  Last:', last.date);
}

testUVAEndpoint().catch(console.error);
