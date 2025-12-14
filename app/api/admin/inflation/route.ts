
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';

export async function GET() {
    try {
        // Fetch from EconomicIndicator (which has interannualValue)
        const data = await prisma.economicIndicator.findMany({
            where: { type: 'IPC' },
            orderBy: { date: 'desc' },
            select: {
                date: true,
                value: true,
                interannualValue: true
            }
        });

        // Transform to match expected format (year, month, value, interannualValue)
        const formatted = data.map(item => {
            const date = new Date(item.date);
            return {
                year: date.getFullYear(),
                month: date.getMonth() + 1, // 1-indexed
                value: item.value,
                interannualValue: item.interannualValue
            };
        });

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
