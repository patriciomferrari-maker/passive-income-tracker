// Test actual API data structure
const fetch = require('node-fetch');

async function testDataOrder() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing data order from APIs...\n');

    // Fetch UVA
    const uvaRes = await fetch(`${baseUrl}/api/economic-data/uva`);
    const uvaData = await res.json();

    console.log('UVA data (first 5):');
    uvaData.slice(0, 5).forEach((item, i) => {
        console.log(`  [${i}]`, item.date);
    });

    console.log('\nUVA data (last 5):');
    uvaData.slice(-5).forEach((item, i) => {
        console.log(`  [${uvaData.length - 5 + i}]`, item.date);
    });

    // Fetch IPC
    const ipcRes = await fetch(`${baseUrl}/api/admin/inflation`);
    const ipcData = await ipcRes.json();

    console.log('\nIPC data (first 5):');
    ipcData.slice(0, 5).forEach((item, i) => {
        console log(`  [${i}] ${item.year}-${String(item.month).padStart(2, '0')}`);
    });
}

testDataOrder().catch(console.error);
