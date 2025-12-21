// Test if compounding is correct
// Example: If we have monthly IPC of 25%, 20%, 15%
// Month 1: 0%
// Month 2: 25%
// Month 3: (1.25) * (1.20) - 1 = 1.5 - 1 = 50%
// Month 4: (1.25) * (1.20) * (1.15) - 1 = 1.725 - 1 = 72.5%

const monthlyInflation = [25.5, 20.6, 13.2, 11.0, 8.8]; // Example from Argentina 2023-2024

let accumulated = 1; // Start at 1 (100%)
console.log('Month 1: 0%');

for (let i = 0; i < monthlyInflation.length; i++) {
    // Use previous month's inflation
    if (i > 0) {
        accumulated *= (1 + monthlyInflation[i - 1] / 100);
    }

    const accumulatedPct = (accumulated - 1) * 100;
    console.log(`Month ${i + 2}: ${accumulatedPct.toFixed(2)}% (used prev month IPC: ${i > 0 ? monthlyInflation[i - 1] : 'N/A'}%)`);
}

console.log('\n--- Verify with 12 months of high inflation ---');
// If Argentina had average 15% monthly inflation for 12 months:
let acc12 = 1;
for (let i = 0; i < 12; i++) {
    acc12 *= 1.15; // 15% monthly
}
console.log(`12 months at 15% monthly: ${((acc12 - 1) * 100).toFixed(1)}%`);

// More realistic: decreasing from 25% to 5%
const realistic = [25, 20, 15, 13, 12, 10, 8, 7, 6, 5, 4, 3.5];
let accRealistic = 1;
for (const r of realistic) {
    accRealistic *= (1 + r / 100);
}
console.log(`Realistic high inflation year: ${((accRealistic - 1) * 100).toFixed(1)}%`);
