import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();

        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        // Get User Settings
        const settings = await prisma.appSettings.findUnique({
            where: { userId }
        });

        let enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        // STRICT ACCESS CONTROL
        // Only allow 'barbosa' and 'costa' for the specific admin email
        const ADMIN_EMAIL = 'patriciomferrari@gmail.com';
        if (user?.email !== ADMIN_EMAIL) {
            enabledSections = enabledSections.filter(s => s !== 'barbosa' && s !== 'costa' && s !== 'costa-esmeralda');
        }

        // Fetch latest Exchange Rate (MEP)
        const mepIndicator = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_dollar_mep' },
            orderBy: { date: 'desc' }
        });
        const exchangeRate = mepIndicator?.value || 1160; // Fallback to approx current rate

        // Get ON stats (Market Value in USD)
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON', userId },
            include: {
                transactions: true
            }
        });

        // 1. Fetch latest prices for these investments to ensure accuracy
        const investmentIds = onInvestments.map(i => i.id);
        const latestPrices = await prisma.assetPrice.findMany({
            where: { investmentId: { in: investmentIds } },
            orderBy: { date: 'desc' },
            // We can't distinct on prisma yet easily without raw query, so just fetch recent
            // Or assuming not too many, fetch all and map in JS
        });

        const priceMap: Record<string, number> = {};
        // Populate map with first found (latest)
        latestPrices.forEach(p => {
            if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price;
        });

        const onCount = onInvestments.length;
        const onTotalInvested = onInvestments.reduce((sum, inv) => {
            const quantityHeld = inv.transactions.reduce((qSum, tx) => {
                if (tx.type === 'BUY') return qSum + tx.quantity;
                if (tx.type === 'SELL') return qSum - tx.quantity;
                return qSum;
            }, 0);

            const rawPrice = priceMap[inv.id] || inv.lastPrice || 0;

            // Logic to match Detailed View + USD Normalization
            let priceInUSD = rawPrice;

            // Detect ARS and convert to USD
            // Threshold 500 assumes price is "per 100" or raw. 
            // - USD ONs are usually ~100.
            // - ARS ONs are usually ~100,000.
            // - Equity ARS is usually ~2000+. 
            // - Equity USD is usually ~10-200.
            if (inv.currency === 'ARS' || rawPrice > 500) {
                priceInUSD = rawPrice / exchangeRate;
            }

            // Normalize "Per 100" quoting for Bonds
            if (inv.type === 'ON' || inv.type === 'CORPORATE_BOND' || inv.type === 'BONO') {
                priceInUSD = priceInUSD / 100;
            }

            return sum + (quantityHeld * priceInUSD);
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

        const needsOnboarding = settings && settings.enabledSections === '';

        const currentMonthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(now);
        const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
        const expenseLabel = `${capitalizedMonth} (Gastos)`;

        // Get Barbosa Stats (Expenses in USD)
        const barbosaTransactions = await prisma.barbosaTransaction.findMany({
            where: {
                userId,
                type: 'EXPENSE',
                date: {
                    gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                }
            }
        });

        const barbosaExpensesCount = barbosaTransactions.length;
        const barbosaExpensesTotalUSD = barbosaTransactions.reduce((sum, t) => {
            // Use stored USD amount if available (best)
            if (t.amountUSD) return sum + t.amountUSD;
            // Or convert using transaction rate (better)
            if (t.exchangeRate) return sum + (t.amount / t.exchangeRate);
            // Or fallback to current rate (ok)
            return sum + (t.amount / exchangeRate);
        }, 0);


        // Get Costa Stats (Expenses in USD)
        const costaTransactions = await prisma.costaTransaction.findMany({
            where: {
                userId,
                type: 'EXPENSE',
                date: {
                    gte: new Date(now.getFullYear(), now.getMonth(), 1),
                    lt: new Date(now.getFullYear(), now.getMonth() + 1, 1)
                }
            }
        });

        const costaExpensesCount = costaTransactions.length;
        const costaExpensesTotal = costaTransactions.reduce((sum, t) => sum + t.amount, 0); // Costa is USD default


        return NextResponse.json({
            needsOnboarding,
            enabledSections,
            on: {
                count: onCount,
                totalInvested: onTotalInvested // This is now Market Value
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
            },
            barbosa: {
                count: barbosaExpensesCount,
                totalMonthly: barbosaExpensesTotalUSD,
                label: expenseLabel,
                monthName: capitalizedMonth
            },
            costa: {
                count: costaExpensesCount,
                totalMonthly: costaExpensesTotal,
                label: expenseLabel,
                monthName: capitalizedMonth
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/dashboard/stats:', error);
        return unauthorized();
    }
}
