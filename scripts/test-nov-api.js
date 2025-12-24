// Test what the frontend receives for Nov 2025
const fetch = require('node-fetch');

async function testNov2025() {
    const baseUrl = 'http://localhost:3000';

    console.log('Testing November 2025 data from APIs...\n');

    // TC Blue
    const tcBlueRes = await fetch(`${baseUrl}/api/admin/economic`);
    const tcBlueData = await tcBlueRes.json();
    const tcBlueNov = tcBlueData.find(item => {
        const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
        return dateStr.startsWith('2025-11');
    });
    console.log('TC Blue Nov 2025 from API:', tcBlueNov ? JSON.stringify(tcBlueNov) : 'NOT FOUND');

    // TC Oficial  
    const tcOficialRes = await fetch(`${baseUrl}/api/economic-data/tc-oficial`);
    const tcOficialData = await tcOficialRes.json();
    const tcOficialNov = tcOficialData.find(item => {
        const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
        return dateStr.startsWith('2025-11');
    });
    console.log('TC Oficial Nov 2025 from API:', tcOficialNov ? JSON.stringify(tcOficialNov) : 'NOT FOUND');
    console.log('\nTC Oficial - All Nov 2025 records:');
    tcOficialData.filter(item => {
        const dateStr = item.date.includes('T') ? item.date.split('T')[0] : item.date;
        return dateStr.startsWith('2025-11');
    }).forEach(item => console.log('  ', item.date, '=', item.value));
}

testNov2025().catch(console.error);
