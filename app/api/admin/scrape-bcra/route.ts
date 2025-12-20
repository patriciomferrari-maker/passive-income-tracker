import { NextResponse } from 'next/server';
import { scrapeBCRA, saveBCRAData } from '@/app/lib/scrapers/bcra';

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        console.log('🌐 Scraping BCRA data...');
        const data = await scrapeBCRA();

        const stats = await saveBCRAData(data);

        return NextResponse.json({
            success: true,
            message: `BCRA scraping completed. Created: ${stats.created}, Updated: ${stats.updated}, Skipped: ${stats.skipped}`,
            data: data.map(d => ({
                type: d.type,
                date: d.date.toISOString().split('T')[0],
                value: d.value,
                interannualValue: d.interannualValue
            }))
        });
    } catch (error) {
        console.error('Error in BCRA scraping endpoint:', error);
        return NextResponse.json(
            { error: 'Failed to scrape BCRA data', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
