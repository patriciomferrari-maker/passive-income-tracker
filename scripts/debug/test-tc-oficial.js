// Test TC Oficial API
const fetch = require('node-fetch');

async function testTCOficial() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing TC Oficial API...\n');

    const res = await fetch(`${baseUrl}/api/economic-data/tc-oficial`);
    const data = await res.json();

    console.log('Response type:', Array.isArray(data) ? 'Array' : typeof data);
    console.log('Count:', Array.isArray(data) ? data.length : 'N/A');

    if (Array.isArray(data) && data.length > 0) {
        console.log('\nFirst 5:');
        data.slice(0, 5).forEach(item => {
            console.log('  ', item.date, '→', item.value);
        });

        console.log('\nLast 5:');
        data.slice(-5).forEach(item => {
            console.log('  ', item.date, '→', item.value);
        });
    } else {
        console.log('No data or error:', data);
    }
}

testTCOficial().catch(console.error);
