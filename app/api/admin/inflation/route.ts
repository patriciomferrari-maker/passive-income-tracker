
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';

export async function GET() {
    try {
        // Fetch from EconomicIndicator (which has interannualValue)
        const data = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' }
        });

        // Transform to match expected format (year, month, value, interannualValue)
        const allFormatted = data.map(item => {
            const date = new Date(item.date);
            return {
                year: date.getFullYear(),
                month: date.getMonth() + 1, // 1-indexed
                value: item.value,
                interannualValue: item.interannualValue,
                _date: item.date // Keep original for sorting
            };
        });

        // ENFORCE: ONE RECORD PER MONTH (keep most recent)
        const uniqueByMonth = new Map();
        allFormatted.forEach(item => {
            const key = `${item.year}-${item.month}`;
            const existing = uniqueByMonth.get(key);

            // Keep the one with the latest date
            if (!existing || item._date > existing._date) {
                uniqueByMonth.set(key, item);
            }
        });

        // Remove _date field and return
        const formatted = Array.from(uniqueByMonth.values()).map(({ _date, ...rest }) => rest);

        return NextResponse.json(formatted);
    } catch (error) {
        console.error('Error fetching inflation data:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}

export async function POST() {
    try {
        const scrapedData = await scrapeInflationData();

        if (scrapedData.length === 0) {
            return NextResponse.json({ message: 'No data scraped' }, { status: 404 });
        }

        let savedCount = 0;

        for (const item of scrapedData) {
            // Convert year/month to Date
            const date = new Date(item.year, item.month - 1, 1, 12, 0, 0, 0); // Noon UTC

            // Save to EconomicIndicator (which has interannualValue field)
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

            // Also save to InflationData for backward compatibility
            await prisma.inflationData.upsert({
                where: {
                    year_month: {
                        year: item.year,
                        month: item.month
                    }
                },
                update: {
                    value: item.value
                },
                create: {
                    year: item.year,
                    month: item.month,
                    value: item.value
                }
            });

            savedCount++;
        }

        return NextResponse.json({
            message: 'Inflation data updated successfully',
            count: savedCount,
            latest: scrapedData[0]
        });
    } catch (error) {
        console.error('Error updating inflation data:', error);
        return NextResponse.json({ error: 'Failed to update data' }, { status: 500 });
    }
}
