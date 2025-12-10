
import { calculateFIFO, FIFOTransaction } from '../app/lib/fifo.ts';

function testFIFO() {
    console.log('--- Testing FIFO Logic ---');

    const ticker = 'TEST_ASSET';
    const transactions: FIFOTransaction[] = [
        { date: new Date('2023-01-01'), type: 'BUY', quantity: 100, price: 10, currency: 'USD' }, // Cost: 1000
        { date: new Date('2023-02-01'), type: 'BUY', quantity: 50, price: 20, currency: 'USD' },  // Cost: 1000
        { date: new Date('2023-03-01'), type: 'SELL', quantity: 120, price: 30, currency: 'USD' } // Sell 120
    ];

    // Expected:
    // Sell 100 from Batch 1 (@10) -> Gain per unit: 30 - 10 = 20 -> Total: 2000
    // Sell 20 from Batch 2 (@20)  -> Gain per unit: 30 - 20 = 10 -> Total: 200
    // Total Gain: 2200
    // Remaining Inventory: 30 from Batch 2 (@20)

    const result = calculateFIFO(transactions, ticker);

    console.log('Realized Gains:', result.realizedGains);
    console.log('Total Gain Abs:', result.totalGainAbs);
    console.log('Remaining Inventory:', result.inventory);

    if (result.totalGainAbs === 2200 && result.inventory.length === 1 && result.inventory[0].quantity === 30) {
        console.log('✅ TEST PASSED');
    } else {
        console.error('❌ TEST FAILED');
    }
}

testFIFO();
