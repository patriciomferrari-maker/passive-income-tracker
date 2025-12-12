
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';

export async function GET() {
    try {
        const data = await prisma.inflationData.findMany({
            orderBy: [
                { year: 'desc' },
                { month: 'desc' }
            ]
            // take: 24 -- Removed to show full history (2019+)
        });

        return NextResponse.json(data);
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
            // Upsert to update if exists (e.g. data correction)
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
