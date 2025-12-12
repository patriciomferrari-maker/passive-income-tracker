
import { PrismaClient } from '@prisma/client';
import { fetchRavaPrice } from '../app/lib/market-data';

const prisma = new PrismaClient();

async function main() {
    const investments = await prisma.investment.findMany({
        where: { ticker: { contains: 'BRK' } },
        include: { user: { select: { email: true } }, assetPrices: true }
    });

    console.log(`Found ${investments.length} investments matching BRK`);
    investments.forEach(inv => {
        console.log(`User: ${inv.user.email}, Ticker: ${inv.ticker}, Currency: ${inv.currency}, LastPrice: ${inv.lastPrice}`);
        inv.assetPrices.forEach(ap => console.log(` - Price: ${ap.price} ${ap.currency} (${ap.date})`));
    });

    // Test Scraper Debug
    console.log('\nTesting Rava Scrape for BRKB Raw...');
    const url = `https://www.rava.com/perfil/BRKB`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const html = await res.text();
        console.log('HTML Length:', html.length);
        const regex = /:res="([^"]+)"/;
        const match = html.match(regex);
        console.log('Regex Match:', match ? 'Yes' : 'No');
        if (!match) {
            console.log('Snippet:', html.substring(0, 500));
            // Check if it's a redirect or empty
        } else {
            const jsonStr = match[1].replace(/&quot;/g, '"');
            console.log('JSON Length:', jsonStr.length);
            const data = JSON.parse(jsonStr);
            console.log('Last Hist:', data.coti_hist ? data.coti_hist.slice(-1) : 'No Hist');
        }
    } catch (e) {
        console.error('Raw Fetch Error:', e);
    }
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
