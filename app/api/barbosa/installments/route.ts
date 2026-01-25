
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
                        comprobante: true,
                        description: true
                    },
                    orderBy: { date: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Computed fields for UI
        const enhancedPlans = plans.map(p => {
            const paidTx = p.transactions.filter(t => t.status === 'REAL');

            // Logic to find Max Quota based on DATE (vs Plan Start)
            // This is more robust than description parsing which might be clean.
            let maxQuota = 0;
            const planStart = new Date(p.startDate);

            paidTx.forEach(t => {
                const tDate = new Date(t.date);
                const yearDiff = tDate.getFullYear() - planStart.getFullYear();
                const monthDiff = tDate.getMonth() - planStart.getMonth();
                // Rounding effectively handles minor day shifts (e.g. 15th vs 1st if logic was loose)
                // But since we aligned StartDate on creation, this should be accurate.
                const quotaIndex = (yearDiff * 12) + monthDiff + 1;

                if (quotaIndex > maxQuota) maxQuota = quotaIndex;
            });

            // If we found a higher quota index than the count (meaning gaps/history missing), use that.
            // Ensure we don't return 0 if there are transactions (min 1)
            if (maxQuota === 0 && paidTx.length > 0) maxQuota = paidTx.length;

            const paidCount = maxQuota;
            const paidAmountReal = paidTx.reduce((sum, t) => sum + t.amount, 0);

            // Calculate Remaining Amount based on PROJECTED transactions (More accurate for future debt)
            const projectedTx = p.transactions.filter(t => t.status === 'PROJECTED');
            const remainingAmount = projectedTx.reduce((sum, t) => sum + t.amount, 0);

            // For UI "Total - Paid", we use remaining amount logic.
            const paidAmountForUI = p.totalAmount - remainingAmount;

            const progress = (paidCount / p.installmentsCount) * 100;

            const now = new Date();
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextDue = p.transactions.find(t => t.status === 'PROJECTED' && new Date(t.date) >= startOfCurrentMonth);

            return {
                ...p,
                paidAmount: paidAmountForUI,
                paidAmountReal: paidAmountReal,
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
