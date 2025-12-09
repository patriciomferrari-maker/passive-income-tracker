import { NextResponse } from 'next/server';
import { updateTreasuries, updateONs, updateIPC } from '@/app/lib/market-data';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const investments = await prisma.investment.findMany({
            where: {
                userId: session.user.id,
                type: { in: ['ON', 'CEDEAR'] },
                ticker: { not: '' }
            },
            select: {
                ticker: true,
                lastPrice: true,
                currency: true,
                lastPriceDate: true
            }
        });

        const prices = investments.map(inv => ({
            ticker: inv.ticker,
            price: inv.lastPrice,
            currency: inv.currency,
            lastUpdated: inv.lastPriceDate
        }));

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
