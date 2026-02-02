
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
            const planStart = new Date(p.startDate);
            const now = new Date(); // Use server time, which is usually correct for this relative check

            // Calculate Elapsed Months (Time-based progress)
            // Example: Start Sep 15. Now Oct 16. Diff = 1 month + 1 day > 1. Total 2.
            let monthsDiff = (now.getFullYear() - planStart.getFullYear()) * 12 + (now.getMonth() - planStart.getMonth());
            if (now.getDate() >= planStart.getDate()) {
                monthsDiff += 1;
            }
            // Clamp between 0 and Total Count
            const timeBasedProgress = Math.max(0, Math.min(monthsDiff, p.installmentsCount));

            // Paid Amount Real (Confirmed payments)
            const paidTx = p.transactions.filter(t => t.status === 'REAL');
            const paidAmountReal = paidTx.reduce((sum, t) => sum + t.amount, 0);

            // Remaining Amount: Sum of FUTURE Projected transactions
            // We consider "Restante" as what is yet to become due.
            // Past projected is considered "Matured" (de facto debt/paid).
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            // Relaxed filter: Projected items that are strictly in future or current month?
            // "Restante" usually means "Outstanding Balance". 
            // If I have a projected installment for Today, is it "Restante"? Yes.
            // If I have one for Last Month, is it "Restante"? No, it's Overdue or Paid (not future).
            // Let's rely on Time Progress for consistent math:
            // Remaining = Total * (1 - Progress/Count) is cleaner but assumes equal installments.
            // Summing projected is safer if amounts vary.
            const futureProjectedTx = p.transactions.filter(t =>
                t.status === 'PROJECTED' && new Date(t.date) > now
            );
            // Fallback: If no projected txs exist (legacy?), prorate.
            // But usually they exist. If list empty, assume 0.
            let remainingAmount = futureProjectedTx.reduce((sum, t) => sum + t.amount, 0);

            // Backup calculation if transactions missing
            if (p.transactions.length === 0 && remainingAmount === 0 && timeBasedProgress < p.installmentsCount) {
                remainingAmount = (p.totalAmount / p.installmentsCount) * (p.installmentsCount - timeBasedProgress);
            }

            const paidAmountForUI = p.totalAmount - remainingAmount;
            const progress = (timeBasedProgress / p.installmentsCount) * 100;

            const nextDue = p.transactions.find(t => t.status === 'PROJECTED' && new Date(t.date) >= startOfCurrentMonth);

            // Calculate End Date
            const endDate = new Date(planStart);
            endDate.setMonth(endDate.getMonth() + (p.installmentsCount - 1));

            return {
                ...p,
                paidAmount: paidAmountForUI,
                paidAmountReal: paidAmountReal,
                paidCount: timeBasedProgress, // Now reflects Time Progress
                progress,
                nextDueDate: nextDue ? nextDue.date : null,
                endDate: endDate.toISOString(), // New Field
                isFinished: timeBasedProgress >= p.installmentsCount,
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
