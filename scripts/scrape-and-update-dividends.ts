import { prisma } from '../lib/prisma';
import { scrapeComafiDividends } from '../app/lib/scrapers/comafi-dividends';

async function main() {
    console.log('🚀 [DividendsUpdate] Starting daily update...');

    try {
        const announcements = await scrapeComafiDividends();
        console.log(`📊 [DividendsUpdate] Scraped ${announcements.length} announcements from Comafi`);

        let newCount = 0;
        let skipCount = 0;

        for (const data of announcements) {
            try {
                // Try to find if it exists
                const existing = await prisma.cedearDividend.findUnique({
                    where: {
                        ticker_announcementDate: {
                            ticker: data.ticker,
                            announcementDate: data.announcementDate
                        }
                    }
                });

                if (existing) {
                    skipCount++;
                    continue;
                }

                // Create new record
                await prisma.cedearDividend.create({
                    data: {
                        ticker: data.ticker,
                        companyName: data.companyName,
                        announcementDate: data.announcementDate,
                        pdfUrl: data.pdfUrl,
                        currency: 'USD', // Default for CEDEARs
                        notes: `Scraped from Comafi: ${data.eventName}`
                    }
                });
                newCount++;
                console.log(`✨ [DividendsUpdate] New dividend: ${data.ticker} (${data.announcementDate.toISOString().split('T')[0]})`);
            } catch (err) {
                console.error(`❌ [DividendsUpdate] Error processing ${data.ticker}:`, err);
            }
        }

        console.log('\n✅ [DividendsUpdate] Finished update:');
        console.log(`   - New announcements: ${newCount}`);
        console.log(`   - Skipped (existing): ${skipCount}`);
        console.log(`   - Total processed: ${announcements.length}`);

    } catch (error) {
        console.error('💥 [DividendsUpdate] Fatal error during update:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
