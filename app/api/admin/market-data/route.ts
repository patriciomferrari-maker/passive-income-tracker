import { NextResponse } from 'next/server';
import { updateTreasuries, updateONs, updateIPC } from '@/app/lib/market-data';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category'); // 'ON' or 'US_ETF'

    let typeFilter: string[] = ['ON', 'CORPORATE_BOND']; // Default
    if (category === 'US_ETF') {
        typeFilter = ['TREASURY', 'ETF', 'STOCK'];
    }

    try {
        const investments = await prisma.investment.findMany({
            where: {
                userId: session.user.id,
                type: { in: typeFilter },
                ticker: { not: '' }
            },
            select: {
                id: true,
                ticker: true,
                type: true,
                lastPrice: true,
                currency: true,
                lastPriceDate: true
            }
        });

        // Fetch latest asset prices for these investments (ARS and USD)
        // We look back 3 days to find recent prices
        const ids = investments.map(i => i.id);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        const assetPrices = await prisma.assetPrice.findMany({
            where: {
                investmentId: { in: ids },
                date: { gte: threeDaysAgo }
            },
            orderBy: { date: 'asc' } // Latest last
        });

        // Map latest price per currency
        const priceMap: Record<string, { ARS?: number, USD?: number }> = {};

        assetPrices.forEach(ap => {
            if (!priceMap[ap.investmentId]) priceMap[ap.investmentId] = {};
            if (ap.currency === 'ARS') priceMap[ap.investmentId].ARS = ap.price;
            if (ap.currency === 'USD') priceMap[ap.investmentId].USD = ap.price;
        });

        const prices = investments.map(inv => {
            const hist = priceMap[inv.id] || {};
            // Prefer historical recent lookup, fallback to investment.lastPrice if matching currency
            const arsPrice = hist.ARS || (inv.currency === 'ARS' ? inv.lastPrice : null);
            const usdPrice = hist.USD || (inv.currency === 'USD' ? inv.lastPrice : null);

            // Implied TC
            const impliedTC = (arsPrice && usdPrice) ? (arsPrice / usdPrice) : null;

            return {
                ticker: inv.ticker,
                type: inv.type,
                price: inv.lastPrice, // Keep legacy for compatibility or debug
                currency: inv.currency,
                lastUpdated: inv.lastPriceDate,
                arsPrice,
                usdPrice,
                impliedTC
            };
        });

        return NextResponse.json({ success: true, prices });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    // ... existing POST logic ...
    const session = await auth();
    // Allow basic admin check or just login for now (Developer mode)
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Admin Action User:', session.user.id);


    try {
        const { action } = await req.json();

        if (action === 'UPDATE_TREASURIES') {
            const prices = await updateTreasuries(session.user.id);
            return NextResponse.json({ success: true, prices });
        }

        if (action === 'UPDATE_ONS') {
            const prices = await updateONs(session.user.id);
            return NextResponse.json({ success: true, prices });
        }

        if (action === 'UPDATE_IPC') {
            const ipc = await updateIPC();
            return NextResponse.json({ success: true, ipc });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
