
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { scrapeInflationData } from '@/app/lib/scrapers/inflation';
import { scrapeDolarBlue } from '@/app/lib/scrapers/dolar';
import { updateONs } from '@/app/lib/market-data';
import { regenerateAllCashflows } from '@/lib/rentals';
import { seedEconomicData } from '@/scripts/seed-economic-data';

// Cron jobs should be protected or use a secret key in production, 
// but for this Vercel setup with 'crons' config, it's open to the scheduler.
// Ideally check 'Authorization' header with CRON_SECRET if needed.

export async function GET(request: Request) {
    // Vercel Cron automatically sends a GET request
    const results = {
        ipc: { status: 'skipped', count: 0, error: null as any },
        dolar: { status: 'skipped', count: 0, error: null as any },
        ons: { status: 'skipped', count: 0, error: null as any },
        bcra: { status: 'skipped', count: 0, error: null as any, seeded: false, created: 0, updated: 0, skipped: 0 }
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

        // SYNC WITH EconomicIndicator (Required for Rentals)
        for (const item of ipcData) {
            const date = new Date(item.year, item.month - 1, 1);
            date.setUTCHours(12, 0, 0, 0); // Noon UTC

            await prisma.economicIndicator.upsert({
                where: { type_date: { type: 'IPC', date } },
                update: { value: item.value },
                create: { type: 'IPC', date, value: item.value }
            });
        }

        if (ipcCount > 0) {
            // Trigger Regeneration of Rental Cashflows
            await regenerateAllCashflows();
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

    // 3. Update ONs
    try {
        // If updateONs is called without args, it updates matching investments for all users (or just all in DB)
        const onsResults = await updateONs();
        results.ons = { status: 'success', count: onsResults.length, error: null };
    } catch (e) {
        results.ons = { status: 'failed', count: 0, error: e instanceof Error ? e.message : String(e) };
        console.error('Cron ONs Error:', e);
    }

    // 4. Update BCRA Data (IPC Mensual/Interanual, UVA, TC Oficial)
    try {
        // Check if we need to seed historical data (first run)
        const existingBCRACount = await prisma.economicIndicator.count({
            where: {
                OR: [
                    { type: 'UVA' },
                    { type: 'TC_OFICIAL' }
                ]
            }
        });

        let seeded = false;
        if (existingBCRACount === 0) {
            console.log('📥 No BCRA data found. Running historical seed...');
            await seedEconomicData();
            seeded = true;
            console.log('✅ BCRA historical seed completed');
        }

        // Scrape latest BCRA data (call directly, no HTTP fetch)
        console.log('🌐 Scraping latest BCRA data...');
        const { scrapeBCRA, saveBCRAData } = await import('@/app/lib/scrapers/bcra');
        const data = await scrapeBCRA();
        const stats = await saveBCRAData(data);

        results.bcra = {
            status: 'success',
            count: stats.created + stats.updated,
            error: null,
            seeded,
            created: stats.created,
            updated: stats.updated,
            skipped: stats.skipped
        };
        console.log(`✅ BCRA update: ${stats.created} created, ${stats.updated} updated`);
    } catch (e) {
        results.bcra = {
            status: 'failed',
            count: 0,
            error: e instanceof Error ? e.message : String(e),
            seeded: false
        };
        console.error('Cron BCRA Error:', e);
    }

    return NextResponse.json({ timestamp: new Date(), results });
}
