// Comprehensive script to clean and repopulate economic data
import { prisma } from '../lib/prisma';
import { scrapeInflationData } from '../app/lib/scrapers/inflation';

async function cleanAndPopulateData() {
    console.log('🧹 Starting data cleanup and repopulation...\n');

    try {
        // Step 1: Clean existing IPC data to avoid duplicates
        console.log('Step 1: Cleaning existing IPC data...');
        const deletedIPC = await prisma.economicIndicator.deleteMany({
            where: { type: 'IPC' }
        });
        console.log(`✅ Deleted ${deletedIPC.count} existing IPC records\n`);

        // Step 2: Scrape fresh inflation data (2019-2025)
        console.log('Step 2: Scraping inflation data from 2019-2025...');
        const scrapedData = await scrapeInflationData();
        console.log(`✅ Scraped ${scrapedData.length} data points\n`);

        if (scrapedData.length === 0) {
            console.log('❌ No data scraped, aborting');
            return;
        }

        // Step 3: Save to database
        console.log('Step 3: Saving to database...');
        let savedCount = 0;
        let withInterannual = 0;

        for (const item of scrapedData) {
            const date = new Date(item.year, item.month - 1, 1, 12, 0, 0, 0);

            await prisma.economicIndicator.upsert({
                where: {
                    type_date: {
                        type: 'IPC',
                        date: date
                    }
                },
                update: {
                    value: item.value,
                    interannualValue: item.interannualValue
                },
                create: {
                    type: 'IPC',
                    date: date,
                    value: item.value,
                    interannualValue: item.interannualValue
                }
            });

            savedCount++;
            if (item.interannualValue) withInterannual++;

            if (savedCount % 20 === 0) {
                console.log(`  Progress: ${savedCount}/${scrapedData.length}...`);
            }
        }

        console.log(`\n✅ Successfully saved ${savedCount} inflation data points`);
        console.log(`   - ${withInterannual} with interannual values`);
        console.log(`   - ${savedCount - withInterannual} monthly only\n`);

        // Step 4: Verify data
        console.log('Step 4: Verifying data...');
        const years = await prisma.economicIndicator.groupBy({
            by: ['date'],
            where: { type: 'IPC' },
            _count: true
        });

        const yearCounts = new Map<number, number>();
        years.forEach(item => {
            const year = new Date(item.date).getFullYear();
            yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
        });

        console.log('Data by year:');
        Array.from(yearCounts.entries()).sort().forEach(([year, count]) => {
            console.log(`  ${year}: ${count} months`);
        });

        console.log('\n🎉 Data cleanup and repopulation completed successfully!');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanAndPopulateData();
