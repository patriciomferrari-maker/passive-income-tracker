
import { fetchRavaPrice, fetchIOLPrice } from '../app/lib/market-data';

async function testSP500() {
    const t = 'S&P500';
    console.log(`\nTicker: ${t}`);
    const rava = await fetchRavaPrice(t);
    console.log(`Rava:`, rava);

    const iol = await fetchIOLPrice(t);
    console.log(`IOL:`, iol);
}

testSP500().catch(e => console.error(e));
