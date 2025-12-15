// Script to manually populate inflation data from 2019-2025
import { prisma } from '../lib/prisma';
import { scrapeInflationData } from '../app/lib/scrapers/inflation';

async function populateInflationData() {
    console.log('Starting inflation data population...');

    try {
        const scrapedData = await scrapeInflationData();
        console.log(`Scraped ${scrapedData.length} data points`);

        if (scrapedData.length === 0) {
            console.log('No data scraped');
            return;
        }

        let savedCount = 0;

        for (const item of scrapedData) {
            // Convert year/month to Date
            const date = new Date(item.year, item.month - 1, 1, 12, 0, 0, 0);

            // Save to EconomicIndicator
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
            if (savedCount % 10 === 0) {
                console.log(`Saved ${savedCount}/${scrapedData.length}...`);
            }
        }

        console.log(`✅ Successfully saved ${savedCount} inflation data points`);
    } catch (error) {
        console.error('Error populating inflation data:', error);
    } finally {
        await prisma.$disconnect();
    }
}

populateInflationData();
