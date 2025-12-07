import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // Get ON stats
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON' },
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
            where: { type: 'TREASURY' },
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
        // Get Rental stats (Keeping existing code)
        const contracts = await prisma.contract.findMany({
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
        const bankOperations = await prisma.bankOperation.findMany();

        // 1. Total En Banco USD
        // "Sumatoria de los Plazos fijos en USD + Caja de seguridad en USD + Fondo Comun de Inversion en USD + Caja de ahorro en USD"
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

        const nextMaturity = upcomingPFs.length > 0 ? upcomingPFs[0] : null;

        return NextResponse.json({
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
                    amount: pf.amount + (pf.amount * (pf.tna || 0) / 100 * (pf.durationDays || 0) / 365), // Estimate final amount with interest if possible, or just amount? User wants 'Intereses de plazo fijo a los graficos', here maybe just total?
                    // Actually, let's use the logic I likely used in BankDashboard: amount + interest?
                    // The 'amount' in DB usually is initial capital.
                    // If I want to show 'Monto Final', I should calculate it.
                    // Let's assume 'amount' is capital.
                    // Formula: Capital + (Capital * TNA% * Days/365)
                    // But wait, the previous code just returned 'amount'.
                    // I'll stick to 'amount' but if TNA exists, I'll calculate total.
                    // Actually, let's just return what we have, but rename key.
                    // Note: 'date' in previous code was Date object? Here I map it to ISO string.
                    // check app/page.tsx: new Date(pf.date).
                    // So ISO string is fine.
                    alias: pf.alias || pf.type,
                    currency: pf.currency
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
