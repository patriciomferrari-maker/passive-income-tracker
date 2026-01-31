import { NextResponse } from 'next/server';
import { seedEconomicData } from '@/scripts/legacy/seed-economic-data';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * Cron job endpoint for automatic daily updates
 * Called by Vercel cron daily at 10 AM UTC (7 AM Argentina)
 */
export async function GET(request: Request) {
    try {
        // Verify cron secret (Vercel provides this automatically)
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🕐 Starting daily economic data update...');

        // 1. Check if we need to seed historical data (first run)
        const existingCount = await prisma.economicIndicator.count({
            where: {
                OR: [
                    { type: 'IPC' },
                    { type: 'UVA' },
                    { type: 'TC_OFICIAL' }
                ]
            }
        });

        if (existingCount === 0) {
            console.log('📥 No existing data found. Running historical seed...');
            await seedEconomicData();
            console.log('✅ Historical seed completed');
        }

        // 2. Scrape latest data from BCRA
        console.log('🌐 Scraping latest BCRA data...');
        const scrapeRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/scrape-bcra`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const scrapeData = await scrapeRes.json();

        if (!scrapeRes.ok) {
            throw new Error(`BCRA scrape failed: ${scrapeData.error}`);
        }

        console.log('✅ Daily update completed successfully');

        return NextResponse.json({
            success: true,
            message: 'Economic data updated',
            seeded: existingCount === 0,
            scraped: scrapeData
        });

    } catch (error) {
        console.error('❌ Error in daily cron job:', error);
        return NextResponse.json(
            {
                error: 'Failed to update economic data',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
