import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { calculateXIRR } from '@/lib/financial';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();
        // Get all US Market investments (Treasuries + ETFs)
        const investments = await prisma.investment.findMany({
            where: {
                userId, // Filter by User
                market: 'US' // Explicitly US Portfolio
                // type: { in: ['TREASURY', 'ETF'] } // Replaced by market: 'US'
            },
            include: {
                transactions: {
                    where: { type: 'BUY' }
                },
                cashflows: {
                    where: { status: 'PROJECTED' },
                    orderBy: { date: 'asc' }
                }
            }
        });

        // Calculate capital invertido (total invested)
        const capitalInvertido = investments.reduce((sum, inv) => {
            const invTotal = inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
            return sum + invTotal;
        }, 0);

        // Split cashflows into Past (Collected) and Future (Projected)
        const today = new Date();

        let capitalCobrado = 0;
        let interesCobrado = 0;
        let capitalACobrar = 0;
        let interesACobrar = 0;

        investments.forEach(inv => {
            if (inv.transactions.length === 0) return;

            inv.cashflows.forEach(cf => {
                const cfDate = new Date(cf.date);
                const isPast = cfDate <= today;

                if (cf.type === 'AMORTIZATION') {
                    if (isPast) capitalCobrado += cf.amount;
                    else capitalACobrar += cf.amount;
                } else if (cf.type === 'INTEREST') {
                    if (isPast) interesCobrado += cf.amount;
                    else interesACobrar += cf.amount;
                }
            });
        });

        // Get próximo pago (next payment)
        const allFutureCashflows = investments.flatMap(inv =>
            inv.cashflows
                .filter(cf => {
                    const hasTransactions = inv.transactions.length > 0;
                    return hasTransactions && new Date(cf.date) > today;
                })
                .map(cf => ({
                    date: cf.date,
                    amount: cf.amount,
                    type: cf.type,
                    ticker: inv.ticker,
                    name: inv.name,
                    description: cf.description
                }))
        ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const proximoPago = allFutureCashflows.length > 0 ? allFutureCashflows[0] : null;

        // Get upcoming payments for chart (next 12 months)
        const twelveMonthsFromNow = new Date();
        twelveMonthsFromNow.setMonth(twelveMonthsFromNow.getMonth() + 12);

        const upcomingPayments = allFutureCashflows
            .filter(cf => new Date(cf.date) <= twelveMonthsFromNow)
            .slice(0, 50); // Limit to 50 payments for performance

        // Calculate portfolio breakdown and TIR
        const portfolioBreakdown = investments.map(inv => {
            const invested = inv.transactions.reduce((sum, tx) => sum + Math.abs(tx.totalAmount), 0);

            // Calculate TIR (Only for Treasuries usually, but per-asset TIR is fine if cashflows exist)
            let tir = 0;
            if (inv.type === 'TREASURY' && inv.cashflows.length > 0) {
                const amounts: number[] = [];
                const dates: Date[] = [];

                inv.transactions.forEach(tx => {
                    amounts.push(-Math.abs(tx.totalAmount));
                    dates.push(new Date(tx.date));
                });

                inv.cashflows.forEach(cf => {
                    amounts.push(cf.amount);
                    dates.push(new Date(cf.date));
                });

                const result = calculateXIRR(amounts, dates);
                tir = result ? result * 100 : 0;
            }

            return {
                ticker: inv.ticker,
                name: inv.name,
                invested,
                percentage: capitalInvertido > 0 ? (invested / capitalInvertido) * 100 : 0,
                tir: tir,
                type: inv.type
            };
        });
        // Removed filter to show 0-invested items in breakdown
        // .filter(item => item.invested > 0);

        // Calculate Consolidated TIR (XIRR) - TREASURIES ONLY
        const allAmounts: number[] = [];
        const allDates: Date[] = [];

        investments.forEach(inv => {
            // Skip ETF or other non-Treasury assets for Consolidated TIR
            if (inv.type !== 'TREASURY') return;

            // Add all BUY transactions as negative cashflows
            inv.transactions.forEach(tx => {
                if (tx.type === 'BUY') {
                    allAmounts.push(-Math.abs(tx.totalAmount));
                    allDates.push(new Date(tx.date));
                }
            });

            // Add all projected cashflows as positive cashflows
            inv.cashflows.forEach(cf => {
                allAmounts.push(cf.amount);
                allDates.push(new Date(cf.date));
            });
        });

        const tirConsolidada = calculateXIRR(allAmounts, allDates);

        // Calculate total a cobrar (capital + interés)
        const totalACobrar = capitalACobrar + interesACobrar;

        return NextResponse.json({
            capitalInvertido,
            capitalCobrado,
            interesCobrado,
            capitalACobrar,
            interesACobrar,
            totalACobrar,
            tirConsolidada: tirConsolidada ? tirConsolidada * 100 : 0,
            proximoPago,
            upcomingPayments,
            portfolioBreakdown,
            totalTreasuries: investments.filter(i => i.type === 'TREASURY').length,
            totalONs: investments.length,
            totalTransactions: investments.reduce((sum, inv) => sum + inv.transactions.length, 0)
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        return unauthorized();
    }
}
