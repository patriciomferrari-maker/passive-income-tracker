import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 25 US ETFs to add to global catalog
const etfs = [
    { ticker: 'VOO', name: 'Vanguard S&P 500 ETF', currency: 'USD', market: 'US' },
    { ticker: 'IVV', name: 'iShares Core S&P 500 ETF', currency: 'USD', market: 'US' },
    { ticker: 'SPY', name: 'SPDR S&P 500 ETF Trust', currency: 'USD', market: 'US' },
    { ticker: 'VTI', name: 'Vanguard Total Stock Market ETF', currency: 'USD', market: 'US' },
    { ticker: 'QQQ', name: 'Invesco QQQ Trust Series I', currency: 'USD', market: 'US' },
    { ticker: 'VUG', name: 'Vanguard Growth ETF', currency: 'USD', market: 'US' },
    { ticker: 'VEA', name: 'Vanguard FTSE Developed Markets ETF', currency: 'USD', market: 'US' },
    { ticker: 'IEFA', name: 'iShares Core MSCI EAFE ETF', currency: 'USD', market: 'US' },
    { ticker: 'VTV', name: 'Vanguard Value ETF', currency: 'USD', market: 'US' },
    { ticker: 'GLD', name: 'SPDR Gold Shares', currency: 'USD', market: 'US' },
    { ticker: 'BND', name: 'Vanguard Total Bond Market ETF', currency: 'USD', market: 'US' },
    { ticker: 'AGG', name: 'iShares Core U.S. Aggregate Bond ETF', currency: 'USD', market: 'US' },
    { ticker: 'IEMG', name: 'iShares Core MSCI Emerging Markets ETF', currency: 'USD', market: 'US' },
    { ticker: 'VXUS', name: 'Vanguard Total International Stock ETF', currency: 'USD', market: 'US' },
    { ticker: 'IWF', name: 'iShares Russell 1000 Growth ETF', currency: 'USD', market: 'US' },
    { ticker: 'VGT', name: 'Vanguard Information Technology ETF', currency: 'USD', market: 'US' },
    { ticker: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', currency: 'USD', market: 'US' },
    { ticker: 'IJH', name: 'iShares Core S&P Mid-Cap ETF', currency: 'USD', market: 'US' },
    { ticker: 'SPYM', name: 'State Street SPDR Portfolio S&P 500 ETF', currency: 'USD', market: 'US' },
    { ticker: 'VIG', name: 'Vanguard Dividend Appreciation ETF', currency: 'USD', market: 'US' },
    { ticker: 'IJR', name: 'iShares Core S&P Small-Cap ETF', currency: 'USD', market: 'US' },
    { ticker: 'VO', name: 'Vanguard Mid-Cap ETF', currency: 'USD', market: 'US' },
    { ticker: 'XLK', name: 'Technology Select Sector SPDR Fund', currency: 'USD', market: 'US' },
    { ticker: 'RSP', name: 'Invesco S&P 500 Equal Weight ETF', currency: 'USD', market: 'US' },
    { ticker: 'ITOT', name: 'iShares Core S&P Total U.S. Stock Market ETF', currency: 'USD', market: 'US' },
];

async function seedGlobalETFs() {
    console.log('🌍 Seeding Global ETF Catalog...\n');

    try {
        let created = 0;
        let skipped = 0;

        for (const etf of etfs) {
            // Check if already exists
            const existing = await prisma.globalAsset.findUnique({
                where: { ticker: etf.ticker }
            });

            if (existing) {
                console.log(`  ⏭️  ${etf.ticker} - Already exists, skipping`);
                skipped++;
                continue;
            }

            // Create new global asset
            await prisma.globalAsset.create({
                data: {
                    ticker: etf.ticker,
                    name: etf.name,
                    type: 'ETF',
                    currency: etf.currency,
                    market: etf.market
                }
            });

            console.log(`  ✅ ${etf.ticker} - ${etf.name}`);
            created++;
        }

        console.log('\n📊 Summary:');
        console.log(`  ✅ Created: ${created}`);
        console.log(`  ⏭️  Skipped: ${skipped}`);
        console.log(`  📈 Total: ${etfs.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

seedGlobalETFs()
    .then(() => {
        console.log('\n🎉 Global ETF catalog seeded successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
