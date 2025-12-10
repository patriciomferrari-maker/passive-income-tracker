
import { fetchRavaPrice } from './app/lib/market-data';

async function main() {
    console.log('Testing Rava Scraping...');
    try {
        const tickers = ['AAPL', 'AAPLD', 'SPY', 'SPYD'];
        for (const t of tickers) {
            console.log(`Fetching ${t}...`);
            const res = await fetchRavaPrice(t);
            console.log(`${t}:`, res);
        }
    } catch (e) {
        console.error(e);
    }
}

main();
