import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';

// This endpoint populates production database with historical inflation data
// Protected by a secret key to prevent unauthorized access
export async function POST(request: Request) {
    try {
        // Simple protection - check for secret key in header
        const authHeader = request.headers.get('authorization');
        const expectedSecret = process.env.ADMIN_SECRET || 'your-secret-key-here';

        if (authHeader !== `Bearer ${expectedSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🧹 Starting production data population...');

        // Step 1: Clean existing IPC data
        console.log('Step 1: Cleaning existing IPC data...');
        const deletedIPC = await prisma.economicIndicator.deleteMany({
            where: { type: 'IPC' }
        });
        console.log(`✅ Deleted ${deletedIPC.count} existing IPC records`);

        // Step 2: Scrape fresh inflation data (2019-2025)
        console.log('Step 2: Scraping inflation data from 2019-2025...');
        const scrapedData = await scrapeInflationData();
        console.log(`✅ Scraped ${scrapedData.length} data points`);

        if (scrapedData.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'No data scraped'
            }, { status: 404 });
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
        }

        console.log(`✅ Successfully saved ${savedCount} inflation data points`);
        console.log(`   - ${withInterannual} with interannual values`);

        // Step 4: Verify data
        const yearCounts = await prisma.$queryRaw<Array<{ year: number, count: bigint }>>`
            SELECT EXTRACT(YEAR FROM date)::int as year, COUNT(*)::int as count
            FROM "EconomicIndicator"
            WHERE type = 'IPC'
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year
        `;

        const summary = yearCounts.map(row => ({
            year: row.year,
            count: Number(row.count)
        }));

        return NextResponse.json({
            success: true,
            message: 'Production data populated successfully',
            stats: {
                totalRecords: savedCount,
                withInterannual: withInterannual,
                byYear: summary
            }
        });

    } catch (error) {
        console.error('❌ Error populating production data:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
