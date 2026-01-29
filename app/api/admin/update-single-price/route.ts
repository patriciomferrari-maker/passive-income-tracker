import { NextResponse } from 'next/server';
import { auth } from '@/auth';
// import yahooFinance from 'yahoo-finance2';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { ticker } = await req.json();

        if (!ticker) {
            return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
        }

        console.log(`[Admin] Updating price for ${ticker}...`);

        // Fetch from Yahoo Finance
        const yahooFinance = (await import('yahoo-finance2')).default;
        const quote = await yahooFinance.quote(ticker);

        if (quote && quote.regularMarketPrice) {
            // Update GlobalAsset
            const updated = await prisma.globalAsset.updateMany({
                where: {
                    ticker,
                    market: 'US'
                },
                data: {
                    lastPrice: quote.regularMarketPrice,
                    lastPriceDate: new Date()
                }
            });

            if (updated.count === 0) {
                return NextResponse.json({
                    error: 'Asset not found in catalog'
                }, { status: 404 });
            }

            console.log(`[Admin] ✓ ${ticker}: $${quote.regularMarketPrice}`);

            return NextResponse.json({
                success: true,
                ticker,
                price: quote.regularMarketPrice,
                currency: quote.currency || 'USD',
                updatedAt: new Date().toISOString()
            });
        } else {
            return NextResponse.json({
                success: false,
                error: 'No price data available from Yahoo Finance'
            }, { status: 404 });
        }
    } catch (e: any) {
        console.error('[Admin] Price update error:', e.message);

        // Check if it's a rate limiting error
        if (e.message?.includes('Too Many Requests') || e.message?.includes('429')) {
            return NextResponse.json({
                success: false,
                error: 'Rate limit exceeded. Please wait a few minutes and try again.'
            }, { status: 429 });
        }

        return NextResponse.json({
            success: false,
            error: e.message || 'Failed to fetch price'
        }, { status: 500 });
    }
}
