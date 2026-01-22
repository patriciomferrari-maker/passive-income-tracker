import yahooFinance from 'yahoo-finance2';

async function testYahoo() {
    const tickers = ['SPY', 'QQQ', 'VOO', 'VTI', 'ARKK'];

    console.log('Testing Yahoo Finance v2 API...\n');

    for (const ticker of tickers) {
        try {
            console.log(`Fetching ${ticker}...`);
            const quote = await yahooFinance.quote(ticker);
            if (quote && quote.regularMarketPrice) {
                console.log(`  ✓ ${ticker}: $${quote.regularMarketPrice} (${quote.currency})`);
            } else {
                console.log(`  ✗ ${ticker}: No price in response`);
            }
        } catch (e: any) {
            console.log(`  ✗ ${ticker}: ERROR - ${e.message}`);
        }
    }
}

testYahoo().catch(console.error);
