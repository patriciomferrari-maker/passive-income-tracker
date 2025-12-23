// Simulate frontend data processing
const mockAPIData = [
    { year: 2024, month: 11, value: 2.4, interannualValue: 166 },
    { year: 2024, month: 12, value: 2.7, interannualValue: 117.8 },
    { year: 2025, month: 1, value: 2.2, interannualValue: 84.5 }
];

// This is what the frontend does (lines 43-48 of AccumulatedChart)
const ipcProcessed = mockAPIData.map(item => ({
    date: `${item.year}-${String(item.month).padStart(2, '0')}-01`,
    value: item.value
})).sort((a, b) => a.date.localeCompare(b.date));

console.log('\n=== Processed IPC Data ===');
ipcProcessed.forEach(d => console.log(d.date, '-', d.value));

// YTD logic
const today = new Date();
const currentYear = today.getFullYear();
const startMonth = `${currentYear - 1}-12`; // Should be "2024-12"

console.log(`\n=== YTD Calculation ===`);
console.log(`startMonth: ${startMonth}`);

// Find first data >= startMonth
const startData = ipcProcessed.find(d => d.date.slice(0, 7) >= startMonth);
console.log(`startData found:`, startData);

if (startData) {
    const startDate = new Date(startData.date);
    console.log(`startDate:`, startDate.toISOString());

    // Format label
    const { format } = require('date-fns');
    const { es } = require('date-fns/locale');
    const label = format(startDate, 'MMMM yyyy', { locale: es });
    console.log(`Label:`, label);
}
