import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        const allDebts = await prisma.debt.findMany({
            where: { userId },
            include: {
                payments: true
            }
        });

        // Separate debts by type
        const debtsIOwe = allDebts.filter(d => d.type === 'I_OWE');
        const debtsOwedToMe = allDebts.filter(d => d.type === 'OWED_TO_ME');

        // Calculate totals for each type
        const calculateTotals = (debts: any[]) => {
            const totalsByCurrency: Record<string, { lent: number, repaid: number, pending: number }> = {};

            debts.forEach(debt => {
                if (!totalsByCurrency[debt.currency]) {
                    totalsByCurrency[debt.currency] = { lent: 0, repaid: 0, pending: 0 };
                }

                const totalPaid = debt.payments
                    .filter((p: any) => p.type === 'PAYMENT' || !p.type)
                    .reduce((sum: number, p: any) => sum + p.amount, 0);

                const totalIncreased = debt.payments
                    .filter((p: any) => p.type === 'INCREASE')
                    .reduce((sum: number, p: any) => sum + p.amount, 0);

                const balance = (debt.initialAmount + totalIncreased) - totalPaid;

                totalsByCurrency[debt.currency].lent += (debt.initialAmount + totalIncreased);
                totalsByCurrency[debt.currency].repaid += totalPaid;
                totalsByCurrency[debt.currency].pending += balance;
            });

            return totalsByCurrency;
        };

        // Calculate debtors/creditors list
        const calculateList = (debts: any[]) => {
            return debts.map(debt => {
                const totalPaid = debt.payments
                    .filter((p: any) => p.type === 'PAYMENT' || !p.type)
                    .reduce((sum: number, p: any) => sum + p.amount, 0);

                const totalIncreased = debt.payments
                    .filter((p: any) => p.type === 'INCREASE')
                    .reduce((sum: number, p: any) => sum + p.amount, 0);

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
        };

        return NextResponse.json({
            // Deudas que tengo (I_OWE)
            iOwe: {
                totals: calculateTotals(debtsIOwe),
                creditors: calculateList(debtsIOwe)
            },
            // Deudas a cobrar (OWED_TO_ME)
            owedToMe: {
                totals: calculateTotals(debtsOwedToMe),
                debtors: calculateList(debtsOwedToMe)
            }
        });

    } catch (error) {
        console.error('Error fetching debt dashboard:', error);
        return unauthorized();
    }
}
