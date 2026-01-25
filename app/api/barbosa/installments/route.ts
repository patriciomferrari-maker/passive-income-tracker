
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

            // Logic to find Max Quota from descriptions (e.g. "Cuota 6/12")
            let maxQuota = 0;
            paidTx.forEach(t => {
                const match = t.description.match(/Cuota\s*(\d+)\//i);
                if (match) {
                    const q = parseInt(match[1]);
                    if (q > maxQuota) maxQuota = q;
                }
            });

            // If we found a higher quota index than the count (meaning gaps/history missing), use that.
            const paidCount = maxQuota > paidTx.length ? maxQuota : paidTx.length;
            const paidAmountReal = paidTx.reduce((sum, t) => sum + t.amount, 0);

            // Calculate Remaining Amount based on PROJECTED transactions (More accurate for future debt)
            const projectedTx = p.transactions.filter(t => t.status === 'PROJECTED');
            const remainingAmount = projectedTx.reduce((sum, t) => sum + t.amount, 0);

            // For UI "Total - Paid", if we have gaps, we should fudge Paid amount or provide Remaining explicitly?
            // Let's provide 'paidAmount' as (Total - Remaining) so the UI math works out for "Restante" column without changing frontend.
            // UI Calculation: Math.max(0, plan.totalAmount - Math.abs(plan.paidAmount))
            // So if we set paidAmount = Total - Remaining, UI will show Remaining.
            const paidAmountForUI = p.totalAmount - remainingAmount;

            const progress = (paidCount / p.installmentsCount) * 100;

            const now = new Date();
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const nextDue = p.transactions.find(t => t.status === 'PROJECTED' && new Date(t.date) >= startOfCurrentMonth);

            return {
                ...p,
                paidAmount: paidAmountForUI, // Virtual Paid Amount to ensure "Restante" is correct
                paidAmountReal: paidAmountReal, // Actual money paid (for debug/details if needed)
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
