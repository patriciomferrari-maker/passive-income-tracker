// Debug YTD data processing
const { format } = require('date-fns');

console.log('Simulating YTD calculation...\n');

// Simulate raw data structure
const rawUVA = [
    { date: '2024-12-15', value: 1650 },
    { date: '2025-01-15', value: 1660 },
    { date: '2025-02-15', value: 1670 },
    { date: '2025-03-15', value: 1680 },
];

const rawIPC = [
    { date: '2024-12-15', value: 2.7 },
    { date: '2025-01-15', value: 2.2 },
    { date: '2025-02-15', value: 2.4 },
];

// YTD logic
const currentYear = 2025;
const startMonth = `${currentYear - 1}-12`; // 2024-12
console.log('YTD startMonth:', startMonth);

const startData = rawUVA.find(d => d.date.slice(0, 7) >= startMonth);
console.log('startData:', startData);

const startDate = new Date(startData.date);
const endDate = new Date(rawUVA[rawUVA.length - 1].date);
console.log('startDate:', startDate);
console.log('endDate:', endDate);

const startMonthKey = format(startDate, 'yyyy-MM');
const endMonthKey = format(endDate, 'yyyy-MM');
console.log('startMonthKey:', startMonthKey);
console.log('endMonthKey:', endMonthKey);

// Find indices
const uvaStartIdx = rawUVA.findIndex(d => d.date.startsWith(startMonthKey));
const ipcStartIdx = rawIPC.findIndex(d => d.date.startsWith(startMonthKey));
console.log('\nuvaStartIdx:', uvaStartIdx);
console.log('ipcStartIdx:', ipcStartIdx);

// useAsBaseline = true for YTD
const baselineUVAIdx = uvaStartIdx;
const baselineIPCIdx = ipcStartIdx;
console.log('baselineUVAIdx:', baselineUVAIdx);
console.log('baselineIPCIdx:', baselineIPCIdx);

// Loop simulation
console.log('\nLoop from', baselineUVAIdx + 1, 'to', rawUVA.length);
const maxIdx = Math.min(rawUVA.length, rawIPC.length);
console.log('maxIdx:', maxIdx);

for (let i = baselineUVAIdx + 1; i < maxIdx; i++) {
    const currentMonthKey = rawUVA[i].date.slice(0, 7);
    console.log(`\ni=${i}, currentMonthKey=${currentMonthKey}, endMonthKey=${endMonthKey}`);

    if (currentMonthKey > endMonthKey) {
        console.log('  BREAK: currentMonthKey > endMonthKey');
        break;
    }

    const ipcIdx = rawIPC.findIndex(d => d.date.startsWith(currentMonthKey));
    console.log(`  ipcIdx: ${ipcIdx}`);

    if (ipcIdx === -1) {
        console.log('  CONTINUE: ipcIdx not found');
        continue;
    }

    console.log('  ✓ Would add point for', currentMonthKey);
}
