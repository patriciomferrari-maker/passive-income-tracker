
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        const startOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

        // 1. Fetch Rates
        const mepIndicator = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_dollar_mep' },
            orderBy: { date: 'desc' }
        });

        const blueIndicator = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: { gte: startOfMonth }
            },
            orderBy: { date: 'asc' }
        });

        // 2. Fetch Transactions (Dashboard Logic)
        const costaTransactions = await prisma.costaTransaction.findMany({
            where: {
                type: 'EXPENSE',
                date: {
                    gte: startOfMonth,
                    lt: startOfNextMonth
                }
            }
        });

        const totalARS = costaTransactions.reduce((sum, t) => sum + t.amount, 0);

        return NextResponse.json({
            now: now.toISOString(),
            range: {
                start: startOfMonth.toISOString(),
                end: startOfNextMonth.toISOString()
            },
            rates: {
                mep: mepIndicator,
                blue: blueIndicator,
                usedRate: blueIndicator?.value || mepIndicator?.value || 1160
            },
            transactions: {
                count: costaTransactions.length,
                totalARS,
                totalUSD_at_UsedRate: totalARS / (blueIndicator?.value || mepIndicator?.value || 1160),
                list: costaTransactions.map(t => ({ date: t.date, amount: t.amount, desc: t.description }))
            }
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
