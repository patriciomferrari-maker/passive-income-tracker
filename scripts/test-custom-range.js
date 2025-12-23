// Test CUSTOM date range filtering
const customStartDate = '2023-10';
const customEndDate = '2025-11';

const customStart = new Date(customStartDate);
const customEnd = new Date(customEndDate);

console.log('customStartDate:', customStartDate);
console.log('customEndDate:', customEndDate);
console.log('customStart:', customStart.toISOString());
console.log('customEnd:', customEnd.toISOString());

// Format like the code does
const { format } = require('date-fns');
const startMonthKey = format(customStart, 'yyyy-MM');
const endMonthKey = format(customEnd, 'yyyy-MM');

console.log('\nstartMonthKey:', startMonthKey);
console.log('endMonthKey:', endMonthKey);

// Test the comparison
const testMonths = ['2025-09', '2025-10', '2025-11', '2025-12'];
testMonths.forEach(month => {
    const shouldInclude = month <= endMonthKey;
    const wouldBreak = month > endMonthKey;
    console.log(`${month}: include=${shouldInclude}, break=${wouldBreak}`);
});
