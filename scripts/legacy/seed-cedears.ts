
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CEDEARS = [
    { ticker: 'GLD', name: 'CEDEAR ETF SPDR GOLD TRUST', sector: 'Materials' },
    { ticker: 'AVGO', name: 'Broadcom', sector: 'Technology' },
    { ticker: 'NVDA', name: 'Nvidia Corporation', sector: 'Technology' },
    { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
    { ticker: 'VALE', name: 'Vale', sector: 'Materials' },
    { ticker: 'KO', name: 'The Coca Cola Company', sector: 'Consumer Staples' },
    { ticker: 'ADGO', name: 'Adecoagro', sector: 'Consumer Staples' },
    { ticker: 'ANF', name: 'Abercrombie & Fitch', sector: 'Consumer Discretionary' },
    { ticker: 'GOOGL', name: 'Alphabet', sector: 'Communication Services' },
    { ticker: 'SATL', name: 'Satellogic', sector: 'Technology' },
    { ticker: 'PBR', name: 'CEDEAR PETROLEO BRASILEIRO S.A.', sector: 'Energy' },
    { ticker: 'IBIT', name: 'CEDEAR ISHARES BITCOIN TR (IBIT)', sector: 'Financials' },
    { ticker: 'JMIA', name: 'Jumia Technologies Ag', sector: 'Consumer Discretionary' },
    { ticker: 'HMY', name: 'Harmony Gold Mining Company', sector: 'Materials' },
    { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
    { ticker: 'UNH', name: 'UnitedHealth Group', sector: 'Health Care' },
    { ticker: 'B', name: 'CEDEAR BARRICK', sector: 'Materials' },
    { ticker: 'BITF', name: 'Bitfarms', sector: 'Technology' },
    { ticker: 'LAR', name: 'CEDEAR LITHIUM AMERICAS (ARGENTINA) CORP', sector: 'Materials' },
    { ticker: 'NU', name: 'CEDEAR NU HOLDINGS LTD/CAYMAN ISLANDS', sector: 'Financials' },
    { ticker: 'KGC', name: 'Kinross Gold Corp', sector: 'Materials' },
    { ticker: 'ADBE', name: 'Adobe Systems', sector: 'Technology' },
    { ticker: 'NFLX', name: 'Netflix', sector: 'Communication Services' },
    { ticker: 'AMZN', name: 'Amazon', sector: 'Consumer Discretionary' },
    { ticker: 'BABA', name: 'Alibaba Group Holding', sector: 'Consumer Discretionary' },
    { ticker: 'GE', name: 'CEDEAR GE AEROSPACE', sector: 'Industrials' },
    { ticker: 'COIN', name: 'Coinbase Global', sector: 'Financials' },
    { ticker: 'BRKB', name: 'Berkshire Hathaway', sector: 'Financials' },
    { ticker: 'QQQ', name: 'Invesco Qqq Trust', sector: 'Technology' },
    { ticker: 'RGTI', name: 'CEDEAR RIGETTI COMPUTING (RGTI)', sector: 'Technology' },
    { ticker: 'AAPL', name: 'Apple', sector: 'Technology' },
    { ticker: 'RIOT', name: 'CEDEAR RIOT PLATFORMS INC.', sector: 'Technology' },
    { ticker: 'GLOB', name: 'Globant', sector: 'Technology' },
    { ticker: 'SLV', name: 'CEDEAR ETF ISHARES SILVER TRUST (SLV)', sector: 'Materials' },
    { ticker: 'TQQQ', name: 'CEDEAR PROSHARES ULTRAPRO QQQ ETF', sector: 'Technology' },
    { ticker: 'MSTR', name: 'Microstrategy', sector: 'Technology' },
    { ticker: 'NKE', name: 'CEDEAR NIKE INC. ESC.', sector: 'Consumer Discretionary' },
    { ticker: 'MELI', name: 'Mercadolibre', sector: 'Consumer Discretionary' },
    { ticker: 'SPY', name: 'Spdr S&P 500', sector: 'Financials' },
    { ticker: 'HUT', name: 'Hut 8 Mining', sector: 'Technology' },
    { ticker: 'ETHA', name: 'CEDEAR ISHARES ETHEREUM TR ETF', sector: 'Financials' },
    { ticker: 'PLTR', name: 'CEDEAR PALANTIR TECHNOLOGIES INC', sector: 'Technology' },
    { ticker: 'STNE', name: 'CEDEAR STONECO LTD', sector: 'Financials' },
    { ticker: 'VIST', name: 'Vista Energy', sector: 'Energy' },
    { ticker: 'ORCL', name: 'CEDEAR ORACLE', sector: 'Technology' },
    { ticker: 'PAGS', name: 'CEDEAR PAGSEGURO DIGITAL LTD', sector: 'Financials' },
    { ticker: 'EWZ', name: 'Ishares Msci Brazil Cap', sector: 'Financials' },
    { ticker: 'TSLA', name: 'Tesla', sector: 'Consumer Discretionary' },
    { ticker: 'MU', name: 'Micron Technology', sector: 'Technology' },
    { ticker: 'META', name: 'Meta Platforms', sector: 'Communication Services' }
];

async function main() {
    console.log('Starting CEDEAR seed...');

    const user = await prisma.user.findUnique({ where: { email: 'patriciomferrari@gmail.com' } });
    if (!user) throw new Error('User patriciomferrari@gmail.com not found');

    console.log(`Seeding for user: ${user.email} (${user.id})`);

    let count = 0;
    for (const item of CEDEARS) {
        // Upsert based on ticker + userId
        await prisma.investment.upsert({
            where: {
                userId_ticker: {
                    userId: user.id,
                    ticker: item.ticker
                }
            },
            update: {
                name: item.name,
                type: 'CEDEAR',
                currency: 'ARS', // Default for CEDEAR
                market: 'ARG',
                sector: item.sector
            },
            create: {
                userId: user.id,
                ticker: item.ticker,
                name: item.name,
                type: 'CEDEAR',
                currency: 'ARS', // Default for CEDEAR
                market: 'ARG',
                frequency: 0, // Not applicable
                sector: item.sector
            }
        });
        count++;
    }
    console.log(`Seeded ${count} CEDEARs.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
