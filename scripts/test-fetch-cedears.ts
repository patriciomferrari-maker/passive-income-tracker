
import { fetchRavaPrice, fetchIOLPrice } from '../app/lib/market-data';

async function testFetch() {
    const tickers = ['AAPL', 'SPY', 'AMZN', 'MSFT', 'X'];
    console.log('--- Testing Fetching ---');
    for (const t of tickers) {
        console.log(`\nTicker: ${t}`);
        const rava = await fetchRavaPrice(t);
        console.log(`Rava:`, rava);

        const iol = await fetchIOLPrice(t);
        console.log(`IOL:`, iol);
    }
}

testFetch().catch(e => console.error(e));
