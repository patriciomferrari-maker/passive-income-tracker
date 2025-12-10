
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { calculateFIFO, FIFOTransaction } from '@/app/lib/fifo';

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const typesParam = searchParams.get('type'); // e.g., 'ON,TREASURY,ETF'

    try {
        // 1. Fetch Investments matching types
        const whereClause: any = {
            userId: session.user.id,
        };

        if (typesParam) {
            whereClause.type = { in: typesParam.split(',') };
        } else {
            // Default types if none specified? Or all?
            // Let's default to all relevant types if not specified
            whereClause.type = { in: ['ON', 'TREASURY', 'ETF', 'CEDEAR', 'STOCK'] };
        }

        const investments = await prisma.investment.findMany({
            where: whereClause,
            include: {
                transactions: true
            }
        });

        const allRealizedGains: any[] = [];
        const inventoryUpdates: any[] = [];

        // 2. Process FIFO for each investment
        for (const inv of investments) {
            // Map Prisma Transaction to FIFOTransaction
            const fifoTx: FIFOTransaction[] = inv.transactions.map(t => ({
                id: t.id,
                date: t.date,
                type: t.type as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                currency: t.currency,
                commission: t.commission
            }));

            const result = calculateFIFO(fifoTx, inv.ticker);

            // Add investment metadata to gains
            const gainsWithMeta = result.realizedGains.map(g => ({
                ...g,
                investmentId: inv.id,
                name: inv.name,
                type: inv.type
            }));

            allRealizedGains.push(...gainsWithMeta);

            // We could also return the "current inventory" to cross-check with expected holdings
            // but for now, the UI primarily needs the gains history.
        }

        // 3. Sort by Date Descending
        allRealizedGains.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ success: true, data: allRealizedGains });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
