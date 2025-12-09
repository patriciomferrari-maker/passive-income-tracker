import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();

        // Get User Settings
        const settings = await prisma.appSettings.findUnique({
            where: { userId }
        });
        const enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        // Get ON stats
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON', userId },
            include: {
                transactions: true
            }
        });

        const onCount = onInvestments.length;
        const onTotalInvested = onInvestments.reduce((sum, inv) => {
            const totalPurchases = inv.transactions.reduce((txSum, tx) =>
                txSum + Math.abs(tx.totalAmount), 0
            );
            return sum + totalPurchases;
        }, 0);

        // Get Treasury stats
        const treasuryInvestments = await prisma.investment.findMany({
            where: { type: 'TREASURY', userId },
            include: {
                transactions: true
            }
        });

        const treasuryCount = treasuryInvestments.length;
        const treasuryTotalInvested = treasuryInvestments.reduce((sum, inv) => {
            const totalPurchases = inv.transactions.reduce((txSum, tx) =>
                txSum + Math.abs(tx.totalAmount), 0
            );
            return sum + totalPurchases;
        }, 0);

        // Get Debt stats
        const debts = await prisma.debt.findMany({
            where: { userId },
            include: {
                payments: true
            }
        });

        const debtsCount = debts.length;
        const totalPending = debts.reduce((sum, d) => {
            const paid = d.payments.reduce((pSum, p) => pSum + p.amount, 0);
            return sum + (d.initialAmount - paid);
        }, 0);

        // Get Rentals stats
        const contracts = await prisma.contract.findMany({
            where: { property: { userId } },
            include: {
                rentalCashflows: {
                    orderBy: { date: 'desc' },
                    take: 1
                }
            }
        });

        const rentalsCount = contracts.length;
        const rentalsTotalValue = contracts.reduce((sum, contract) => {
            const lastPayment = contract.rentalCashflows[0];
            return sum + (lastPayment?.amountUSD || 0);
        }, 0);

        // Get Bank Stats (NEW)
        const bankOperations = await prisma.bankOperation.findMany({
            where: { userId }
        });

        // 1. Total En Banco USD
        const bankTotalUSD = bankOperations
            .filter(op => op.currency === 'USD')
            .reduce((sum, op) => sum + op.amount, 0);

        // 2. Próximo Vencimiento (Plazo Fijo)
        const now = new Date();
        const pfs = bankOperations.filter(op => op.type === 'PLAZO_FIJO' && op.startDate && op.durationDays);

        const upcomingPFs = pfs.map(pf => {
            const start = new Date(pf.startDate!);
            const end = new Date(start);
            end.setDate(start.getDate() + (pf.durationDays || 0));
            const diffTime = end.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return { ...pf, endDate: end, daysLeft };
        }).filter(pf => pf.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);

        return NextResponse.json({
            enabledSections,
            on: {
                count: onCount,
                totalInvested: onTotalInvested
            },
            treasury: {
                count: treasuryCount,
                totalInvested: treasuryTotalInvested
            },
            debts: {
                count: debtsCount,
                totalPending
            },
            rentals: {
                count: rentalsCount,
                totalValue: rentalsTotalValue
            },
            bank: {
                totalUSD: bankTotalUSD,
                nextMaturitiesPF: upcomingPFs.slice(0, 3).map(pf => ({
                    daysLeft: pf.daysLeft,
                    date: pf.endDate.toISOString(),
                    amount: pf.amount + (pf.amount * (pf.tna || 0) / 100 * (pf.durationDays || 0) / 365),
                    alias: pf.alias || pf.type,
                    currency: pf.currency
                }))
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/dashboard/stats:', error);
        return unauthorized();
    }
}
