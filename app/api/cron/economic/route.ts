
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';
import { scrapeDolarBlue } from '@/app/lib/scrapers/dolar';

// Cron jobs should be protected or use a secret key in production, 
// but for this Vercel setup with 'crons' config, it's open to the scheduler.
// Ideally check 'Authorization' header with CRON_SECRET if needed.

export async function GET(request: Request) {
    // Vercel Cron automatically sends a GET request
    const results = {
        ipc: { status: 'skipped', count: 0, error: null as any },
        dolar: { status: 'skipped', count: 0, error: null as any }
    };

    // 1. Update IPC
    try {
        const ipcData = await scrapeInflationData();
        let ipcCount = 0;
        for (const item of ipcData) {
            await prisma.inflationData.upsert({
                where: { year_month: { year: item.year, month: item.month } },
                update: { value: item.value },
                create: { year: item.year, month: item.month, value: item.value }
            });
            ipcCount++;
        }
        results.ipc = { status: 'success', count: ipcCount, error: null };
    } catch (e) {
        results.ipc = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
        console.error('Cron IPC Error:', e);
    }

    // 2. Update Dollar (Last 7 days is enough for daily cron)
    try {
        // Scrape last 7 days to cover weekends/holidays gaps
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const dollarData = await scrapeDolarBlue(startDate, endDate);
        let dollarCount = 0;

        for (const item of dollarData) {
            const dayStart = new Date(item.date);
            dayStart.setUTCHours(0, 0, 0, 0);
            const dayEnd = new Date(item.date);
            dayEnd.setUTCHours(23, 59, 59, 999);

            const existing = await prisma.economicIndicator.findFirst({
                where: { type: 'TC_USD_ARS', date: { gte: dayStart, lte: dayEnd } }
            });

            if (existing) {
                // Update even if exists, to get latest closing price
                await prisma.economicIndicator.update({
                    where: { id: existing.id },
                    data: { value: item.avg, buyRate: item.buy, sellRate: item.sell }
                });
            } else {
                await prisma.economicIndicator.create({
                    data: { type: 'TC_USD_ARS', date: item.date, value: item.avg, buyRate: item.buy, sellRate: item.sell }
                });
            }
            dollarCount++;
        }
        results.dolar = { status: 'success', count: dollarCount, error: null };
    } catch (e) {
        results.dolar = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
        console.error('Cron Dollar Error:', e);
    }

    return NextResponse.json({ timestamp: new Date(), results });
}
