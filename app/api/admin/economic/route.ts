
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeDolarBlue } from '@/app/lib/scrapers/dolar';

export async function GET() {
    try {
        const data = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'desc' },
            // Removed take limit to show full history
        });

        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch dollar data' }, { status: 500 });
    }
}

export async function POST() {
    try {
        // Scrape from 2019-01-01 as requested
        const today = new Date().toISOString().split('T')[0];
        const scrapedData = await scrapeDolarBlue('2019-01-01', today);

        let count = 0;
        for (const item of scrapedData) {
            // Normalize date to remove time for unique constraint check
            const dayStart = new Date(item.date);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(item.date);
            dayEnd.setUTCHours(23, 59, 59, 999);

            const existing = await prisma.economicIndicator.findFirst({
                where: {
                    type: 'TC_USD_ARS',
                    date: { gte: dayStart, lte: dayEnd }
                }
            });

            if (existing) {
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: {
                        value: item.avg,
                        buyRate: item.buy,
                        sellRate: item.sell,
                        date: item.date // Update time if needed
                    }
                });
            } else {
                await prisma.economicIndicator.create({
                    data: {
                        type: 'TC_USD_ARS',
                        date: item.date,
                        value: item.avg,
                        buyRate: item.buy,
                        sellRate: item.sell
                    }
                });
            }
            count++;
        }

        return NextResponse.json({ message: 'Updated successfully', count });
    } catch (error) {
        console.error('Error updating dollar:', error);
        return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }
}
