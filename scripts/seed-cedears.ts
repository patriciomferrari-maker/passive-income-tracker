
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CEDEARS = [
    { ticker: 'GLD', name: 'CEDEAR ETF SPDR GOLD TRUST' },
    { ticker: 'AVGO', name: 'Broadcom' },
    { ticker: 'NVDA', name: 'Nvidia Corporation' },
    { ticker: 'AMD', name: 'Advanced Micro Devices' },
    { ticker: 'VALE', name: 'Vale' },
    { ticker: 'KO', name: 'The Coca Cola Company' },
    { ticker: 'ADGO', name: 'Adecoagro' },
    { ticker: 'ANF', name: 'Abercrombie & Fitch' },
    { ticker: 'GOOGL', name: 'Alphabet' },
    { ticker: 'SATL', name: 'Satellogic' },
    { ticker: 'PBR', name: 'CEDEAR PETROLEO BRASILEIRO S.A.' },
    { ticker: 'IBIT', name: 'CEDEAR ISHARES BITCOIN TR (IBIT)' },
    { ticker: 'JMIA', name: 'Jumia Technologies Ag' },
    { ticker: 'HMY', name: 'Harmony Gold Mining Company' },
    { ticker: 'MSFT', name: 'Microsoft' },
    { ticker: 'UNH', name: 'UnitedHealth Group' },
    { ticker: 'B', name: 'CEDEAR BARRICK' },
    { ticker: 'BITF', name: 'Bitfarms' },
    { ticker: 'LAR', name: 'CEDEAR LITHIUM AMERICAS (ARGENTINA) CORP' },
    { ticker: 'NU', name: 'CEDEAR NU HOLDINGS LTD/CAYMAN ISLANDS' },
    { ticker: 'KGC', name: 'Kinross Gold Corp' },
    { ticker: 'ADBE', name: 'Adobe Systems' },
    { ticker: 'NFLX', name: 'Netflix' },
    { ticker: 'AMZN', name: 'Amazon' },
    { ticker: 'BABA', name: 'Alibaba Group Holding' },
    { ticker: 'GE', name: 'CEDEAR GE AEROSPACE' },
    { ticker: 'COIN', name: 'Coinbase Global' },
    { ticker: 'BRKB', name: 'Berkshire Hathaway' },
    { ticker: 'QQQ', name: 'Invesco Qqq Trust' },
    { ticker: 'RGTI', name: 'CEDEAR RIGETTI COMPUTING (RGTI)' }, // Fixed case
    { ticker: 'AAPL', name: 'Apple' },
    { ticker: 'RIOT', name: 'CEDEAR RIOT PLATFORMS INC.' },
    { ticker: 'GLOB', name: 'Globant' },
    { ticker: 'SLV', name: 'CEDEAR ETF ISHARES SILVER TRUST (SLV)' },
    { ticker: 'TQQQ', name: 'CEDEAR PROSHARES ULTRAPRO QQQ ETF' },
    { ticker: 'MSTR', name: 'Microstrategy' },
    { ticker: 'NKE', name: 'CEDEAR NIKE INC. ESC.' },
    { ticker: 'MELI', name: 'Mercadolibre' },
    { ticker: 'SPY', name: 'Spdr S&P 500' },
    { ticker: 'HUT', name: 'Hut 8 Mining' },
    { ticker: 'ETHA', name: 'CEDEAR ISHARES ETHEREUM TR ETF' },
    { ticker: 'PLTR', name: 'CEDEAR PALANTIR TECHNOLOGIES INC' },
    { ticker: 'STNE', name: 'CEDEAR STONECO LTD' },
    { ticker: 'VIST', name: 'Vista Energy' },
    { ticker: 'ORCL', name: 'CEDEAR ORACLE' },
    { ticker: 'PAGS', name: 'CEDEAR PAGSEGURO DIGITAL LTD' },
    { ticker: 'EWZ', name: 'Ishares Msci Brazil Cap' },
    { ticker: 'TSLA', name: 'Tesla' },
    { ticker: 'MU', name: 'Micron Technology' },
    { ticker: 'META', name: 'Meta Platforms' }
];

async function main() {
    console.log('Starting CEDEAR seed...');

    // Assuming context is for a specific user or global.
    // The previous Investment model implies userId is required and ticker is unique per User.
    // However, keeping an Asset Database separate from User Investments is cleaner.
    // BUT valid schema `Investment` has `userId`.
    // Wait, if I seed these, I must assign them to a user.
    // Does the user want these as "Options" available to pick?
    // If filtering by available assets, usually we query existing investments.
    // But for a "Purchase", we might want to select from a catalog.
    // The current `TransactionFormModal` fetches assets from `/api/investments/on`.
    // Let's check that API. If it returns only what the user HAS, then we can't buy new ones easily.
    // If it returns a global list, then we are good.
    // Checking `app/api/investments/on/route.ts`...

    // Find specific user
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
                market: 'ARG'
            },
            create: {
                userId: user.id,
                ticker: item.ticker,
                name: item.name,
                type: 'CEDEAR',
                currency: 'ARS', // Default for CEDEAR
                market: 'ARG',
                frequency: 0 // Not applicable
            }
        });
        count++;
    }
    console.log(`Seeded ${count} CEDEARs.`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
