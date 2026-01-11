
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const plans = await prisma.barbosaInstallmentPlan.findMany({
            where: { userId },
            include: {
                category: true,
                transactions: {
                    select: {
                        id: true,
                        date: true,
                        amount: true,
                        status: true,
                        isStatistical: true,
                        comprobante: true
                    },
                    orderBy: { date: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Computed fields for UI
        const enhancedPlans = plans.map(p => {
            const paidTx = p.transactions.filter(t => t.status === 'REAL');
            const paidAmount = paidTx.reduce((sum, t) => sum + t.amount, 0);
            const paidCount = paidTx.length;

            const progress = (paidCount / p.installmentsCount) * 100;

            const nextDue = p.transactions.find(t => t.status === 'PROJECTED');

            return {
                ...p,
                paidAmount,
                paidCount,
                progress,
                nextDueDate: nextDue ? nextDue.date : null,
                isFinished: paidCount >= p.installmentsCount,
                // These are common to all transactions in the plan
                isStatistical: p.transactions[0]?.isStatistical || false,
                comprobante: p.transactions[0]?.comprobante || null
            };
        });

        return NextResponse.json(enhancedPlans);

    } catch (error: any) {
        console.error('Installments Fetch Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
