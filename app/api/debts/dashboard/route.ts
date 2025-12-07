import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const allDebts = await prisma.debt.findMany({
            include: {
                payments: true
            }
        });

        const totalsByCurrency: Record<string, { lent: number, repaid: number, pending: number }> = {};

        allDebts.forEach(debt => {
            if (!totalsByCurrency[debt.currency]) {
                totalsByCurrency[debt.currency] = { lent: 0, repaid: 0, pending: 0 };
            }

            const totalPaid = debt.payments
                .filter(p => p.type === 'PAYMENT' || !p.type)
                .reduce((sum, p) => sum + p.amount, 0);

            const totalIncreased = debt.payments
                .filter(p => p.type === 'INCREASE')
                .reduce((sum, p) => sum + p.amount, 0);

            const balance = (debt.initialAmount + totalIncreased) - totalPaid;

            totalsByCurrency[debt.currency].lent += (debt.initialAmount + totalIncreased);
            totalsByCurrency[debt.currency].repaid += totalPaid;
            totalsByCurrency[debt.currency].pending += balance;
        });

        // Top Debtors
        const debtors = allDebts.map(debt => {
            const totalPaid = debt.payments
                .filter(p => p.type === 'PAYMENT' || !p.type)
                .reduce((sum, p) => sum + p.amount, 0);

            const totalIncreased = debt.payments
                .filter(p => p.type === 'INCREASE')
                .reduce((sum, p) => sum + p.amount, 0);

            const balance = (debt.initialAmount + totalIncreased) - totalPaid;
            const currentTotalDebt = debt.initialAmount + totalIncreased;

            return {
                name: debt.debtorName,
                debtId: debt.id,
                amount: currentTotalDebt,
                paid: totalPaid,
                pending: balance,
                progress: currentTotalDebt > 0 ? (totalPaid / currentTotalDebt) * 100 : 0,
                currency: debt.currency
            };
        }).sort((a, b) => b.pending - a.pending);

        return NextResponse.json({
            totals: totalsByCurrency,
            debtors
        });

    } catch (error) {
        console.error('Error fetching debt dashboard:', error);
        return NextResponse.json({ error: 'Failed to fetch dashboard' }, { status: 500 });
    }
}
