
import 'dotenv/config';
import { TwelveDataClient } from '../lib/utils/twelve-data';

async function main() {
    const client = new TwelveDataClient();

    console.log('🧪 Testing Twelve Data Integration');
    console.log('--------------------------------');

    // Test a small batch first
    const testTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'];

    console.log(`📡 Fetching prices for ${testTickers.length} symbols...`);
    const prices = await client.fetchBatchedPrices(testTickers);

    console.log('\n📊 Results:');
    prices.forEach((price, ticker) => {
        console.log(`   ${ticker}: $${price}`);
    });

    if (prices.size === 0) {
        console.log('\n❌ No prices returned. Check API Key or Rate Limits.');
    } else {
        console.log(`\n✅ Successfully fetched ${prices.size}/${testTickers.length} prices.`);
    }
}

main();
