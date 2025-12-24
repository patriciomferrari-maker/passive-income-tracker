// Check first dates of all indicators in production
const fetch = require('node-fetch');

async function checkProductionData() {
    const PROD_URL = 'https://passive-income-tracker.vercel.app';

    console.log('Checking first dates in production...\n');

    // Check UVA
    const uvaRes = await fetch(`${PROD_URL}/api/economic-data/uva`);
    const uvaData = await uvaRes.json();
    const uvaFirst = uvaData.sort((a, b) => a.date.localeCompare(b.date))[0];
    console.log('UVA first:', uvaFirst.date.slice(0, 10));
    console.log('UVA count:', uvaData.length);
    console.log('');

    // Check IPC (inflation)
    const ipcRes = await fetch(`${PROD_URL}/api/admin/inflation`);
    const ipcData = await ipcRes.json();
    const ipcSorted = ipcData.sort((a, b) => a.year - b.year || a.month - b.month);
    const ipcFirst = ipcSorted[0];
    const ipcFirstDate = `${ipcFirst.year}-${String(ipcFirst.month).padStart(2, '0')}`;
    console.log('IPC first:', ipcFirstDate);
    console.log('IPC count:', ipcData.length);
    console.log('');

    // Check TC Blue
    const tcRes = await fetch(`${PROD_URL}/api/admin/economic`);
    const tcData = await tcRes.json();
    const tcFirst = tcData.sort((a, b) => a.date.localeCompare(b.date))[0];
    console.log('TC Blue first:', tcFirst.date.slice(0, 10));
    console.log('TC Blue count:', tcData.length);
    console.log('');

    // Check TC Oficial
    const tcOficialRes = await fetch(`${PROD_URL}/api/economic-data/tc-oficial`);
    const tcOficialData = await tcOficialRes.json();
    const tcOficialFirst = tcOficialData.sort((a, b) => a.date.localeCompare(b.date))[0];
    console.log('TC Oficial first:', tcOficialFirst.date.slice(0, 10));
    console.log('TC Oficial count:', tcOficialData.length);
    console.log('');

    // Determine which is limiting
    const dates = [
        { name: 'UVA', date: uvaFirst.date.slice(0, 7) },
        { name: 'IPC', date: ipcFirstDate },
        { name: 'TC Blue', date: tcFirst.date.slice(0, 7) },
        { name: 'TC Oficial', date: tcOficialFirst.date.slice(0, 7) }
    ];

    const sorted = dates.sort((a, b) => b.date.localeCompare(a.date));
    console.log('Sorted by first date (latest first - most restrictive):');
    sorted.forEach(d => console.log(`  ${d.name}: ${d.date}`));
    console.log('');
    console.log(`🔴 LIMITING INDICATOR: ${sorted[0].name} (${sorted[0].date})`);
    console.log(`This is why ALL starts from ${sorted[0].date}`);
}

checkProductionData().catch(console.error);
