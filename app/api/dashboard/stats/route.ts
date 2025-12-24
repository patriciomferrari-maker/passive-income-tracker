import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        let userId;
        try {
            userId = await getUserId();
        } catch (authError) {
            // If getUserId fails, return 401 instead of 500
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const now = new Date();

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

        // Fetch latest Exchange Rate (MEP) for ONs
        const mepIndicator = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_dollar_mep' },
            orderBy: { date: 'desc' }
        });
        const exchangeRate = mepIndicator?.value || 1160;

        // Fetch TC for Costa (mimicking CashflowTab logic: Start of Month Rate)
        // CashflowTab fetches TC_USD_ARS order ASC, and takes the first one for the month.
        const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        const startOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));

        const blueIndicator = await prisma.economicIndicator.findFirst({
            where: {
                type: 'TC_USD_ARS',
                date: { gte: startOfMonth }
            },
            orderBy: { date: 'asc' } // Match CashflowTab's "first of month" behavior
        });

        // If no rate found for this month, fallback to MEP or previous Blue?
        // Using exchangeRate (MEP) as safe fallback, but usually TC_USD_ARS should exist if Costa data exists.
        const costaExchangeRate = blueIndicator?.value || exchangeRate;

        // Get ON stats (Market Value in USD)
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON', userId },
            include: {
                transactions: true
            }
        });

        // ...



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

            // Heuristic: If price is > 500, it is likely ARS per 100 (e.g. 150,000).
            // If price is < 500, it is likely USD per 100 (e.g. 104.00) or USD Unit (1.04).
            // AssetPrice table seems to hold USD/D prices (e.g. 108.75).
            if (rawPrice > 500) {
                priceInUSD = rawPrice / exchangeRate;
            }

            // Normalize "Per 100" quoting for Bonds
            // Most ONs match this.
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
                    gte: startOfMonth,
                    lt: startOfNextMonth
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
        // Costa inputs seem to be in ARS mostly (based on debug values ~2M)
        const costaTransactions = await prisma.costaTransaction.findMany({
            where: {
                userId,
                type: 'EXPENSE',
                date: {
                    gte: startOfMonth,
                    lt: startOfNextMonth
                }
            }
        });

        const costaExpensesCount = costaTransactions.length;
        const costaExpensesTotalARS = costaTransactions.reduce((sum, t) => sum + t.amount, 0);
        // Assuming Costa is ARS inputs, convert to USD.
        // If we had a currency field we trust we'd use it, but schema default is USD while data is ARS.
        // Heuristic: If total > 10,000 implies ARS? 
        // Or just always divide by exchange rate if we know user inputs ARS?
        // Let's divide by exchange rate. 
        const costaExpensesTotal = costaExpensesTotalARS / costaExchangeRate;


        return NextResponse.json({
            needsOnboarding,
            enabledSections,
            userEmail: user?.email,
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
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
