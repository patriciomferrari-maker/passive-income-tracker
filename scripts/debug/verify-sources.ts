
import { updateONs, updateTreasuries } from '../app/lib/market-data';
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- Verifying Market Data Sources ---');

    console.log('\n1. Testing Treasuries & ETFs (Should be Yahoo)...');
    try {
        const treasuryResults = await updateTreasuries();
        treasuryResults.forEach(r => {
            console.log(`[${r.ticker}] Price: ${r.price} ${r.currency} | Source: ${r.source} | Error: ${r.error || 'None'}`);
        });
    } catch (e) {
        console.error('Error testing Treasuries:', e);
    }

    console.log('\n2. Testing ONs (Should be IOL, fallback Yahoo)...');
    try {
        const onResults = await updateONs();
        onResults.forEach(r => {
            console.log(`[${r.ticker}] Price: ${r.price} ${r.currency} | Source: ${r.source} | Error: ${r.error || 'None'}`);
        });
    } catch (e) {
        console.error('Error testing ONs:', e);
    }
}

main().catch(console.error);
