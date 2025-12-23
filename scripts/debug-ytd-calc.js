// Debug YTD calculation
const today = new Date();
const currentYear = today.getFullYear();

console.log('=== YTD Debug ===');
console.log(`Current date: ${today.toISOString()}`);
console.log(`Current year: ${currentYear}`);
console.log(`YTD start month should be: ${currentYear - 1}-12 (Dec ${currentYear - 1})`);

// Simulate what the code does
const startMonth = `${currentYear - 1}-12`;
console.log(`\nCalculated start month: ${startMonth}`);

// Check if we're in 2025
if (currentYear === 2025) {
    console.log('\n✓ Year is 2025');
    console.log('✓ YTD should start at: 2024-12 (December 2024)');
    console.log('✓ Baseline: Dec 2024 = 0%');
    console.log('✓ Data: Jan 2025 - Nov 2025');
}
