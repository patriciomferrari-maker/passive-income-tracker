import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { fetchRavaPrice } from '@/app/lib/market-data';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // 1. Get all CEDEARs and ETFs
        const investments = await prisma.investment.findMany({
            where: {
                type: { in: ['CEDEAR', 'ETF'] },
                ticker: { not: '' }
            },
            select: { ticker: true, type: true }
        });

        // Unique tickers
        const uniqueTickers = Array.from(new Set(investments.map(i => i.ticker)));

        const results = [];

        for (const ticker of uniqueTickers) {
            // Fetch ARS (Ticker)
            const arsData = await fetchRavaPrice(ticker);
            // Fetch USD (Ticker + D)
            const usdData = await fetchRavaPrice(ticker + 'D');

            const arsPrice = arsData?.price || null;
            const usdPrice = usdData?.price || null;

            let tc = null;
            if (arsPrice && usdPrice && usdPrice > 0) {
                tc = arsPrice / usdPrice;
            }

            results.push({
                ticker,
                arsPrice,
                usdPrice,
                tc,
                lastUpdate: arsData?.updateDate || usdData?.updateDate || new Date()
            });
        }

        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching Cedear quotes:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
