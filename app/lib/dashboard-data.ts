
import { prisma } from '@/lib/prisma';

export async function getDashboardStats(userId: string) {
    const now = new Date();

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true }
    });

    if (!user) throw new Error("User not found");

    // Get User Settings
    const settings = await prisma.appSettings.findUnique({
        where: { userId },
        select: { userId: true, enabledSections: true, reportDay: true, reportHour: true }
    });

    let enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

    // Fetch latest Exchange Rate (TC_USD_ARS) - Blue Dollar
    const latestExchangeRate = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });

    const exchangeRate = latestExchangeRate?.value || 1160;

    // =========================================================================================
    // 1. CARTERA ARGENTINA (ONs, CEDEARs, ETFs)
    // =========================================================================================
    const onInvestments = await prisma.investment.findMany({
        where: { userId, market: 'ARG' },
        select: {
            id: true,
            lastPrice: true,
            type: true,
            ticker: true,
            currency: true,
            transactions: {
                select: {
                    id: true,
                    date: true,
                    type: true,
                    quantity: true,
                    price: true,
                    commission: true,
                    currency: true
                }
            }
        }
    });

    const onIds = onInvestments.map(i => i.id);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentPrices = await prisma.assetPrice.findMany({
        where: {
            investmentId: { in: onIds },
            date: { gte: weekAgo }
        },
        orderBy: { date: 'desc' }
    });

    const priceMap: Record<string, number> = {};
    recentPrices.forEach(p => {
        if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price;
    });

    // Import FIFO calculation
    const { calculateFIFO } = await import('@/app/lib/fifo');

    let onMarketValueUSD = 0;
    let activeOnCount = 0;

    for (const inv of onInvestments) {
        const fifoTxs = inv.transactions.map(t => ({
            id: t.id,
            date: new Date(t.date),
            type: (t.type || '').toUpperCase() as 'BUY' | 'SELL',
            quantity: t.quantity,
            price: t.price,
            commission: t.commission,
            currency: t.currency
        }));

        const result = calculateFIFO(fifoTxs, inv.ticker);
        let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

        if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && currentPrice > 2.0) {
            currentPrice = currentPrice / 100;
        }

        let instrumentValue = 0;
        let totalHeld = 0;

        result.openPositions.forEach(p => {
            const value = p.quantity * currentPrice;
            instrumentValue += value;
            totalHeld += p.quantity;
        });

        if (totalHeld > 0) {
            onMarketValueUSD += instrumentValue;
            activeOnCount++;
        }
    }

    // =========================================================================================
    // 2. TREASURY (Cartera USA)
    // =========================================================================================
    const treasuryInvestments = await prisma.investment.findMany({
        where: { type: 'TREASURY', userId },
        select: {
            transactions: {
                select: { totalAmount: true }
            }
        }
    });

    const treasuryCount = treasuryInvestments.length;
    const treasuryTotalInvested = treasuryInvestments.reduce((sum, inv) => {
        return sum + inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
    }, 0);

    // =========================================================================================
    // 3. DEBTS
    // =========================================================================================
    const debts = await prisma.debt.findMany({
        where: { userId },
        select: {
            initialAmount: true,
            type: true,
            payments: { select: { amount: true, type: true } }
        }
    });

    const totalPending = debts.reduce((sum, d) => {
        const paid = d.payments
            .filter(p => !p.type || p.type === 'PAYMENT')
            .reduce((pSum, p) => pSum + p.amount, 0);

        const increased = d.payments
            .filter(p => p.type === 'INCREASE')
            .reduce((pSum, p) => pSum + p.amount, 0);

        const pending = (d.initialAmount + increased) - paid;

        if (d.type === 'I_OWE') return sum - pending;
        else return sum + pending;
    }, 0);

    // =========================================================================================
    // 4. RENTALS
    // =========================================================================================
    const consolidatedProperties = await prisma.property.findMany({
        where: { userId, isConsolidated: true },
        select: { id: true }
    });

    const contracts = await prisma.contract.findMany({
        where: { propertyId: { in: consolidatedProperties.map(p => p.id) } },
        select: {
            property: { select: { role: true } },
            rentalCashflows: {
                where: { date: { lte: now } },
                orderBy: { date: 'desc' },
                take: 1,
                select: { amountUSD: true }
            }
        }
    });

    let rentalsTotalIncome = 0;
    let rentalsTotalExpense = 0;

    contracts.forEach(contract => {
        const lastPayment = contract.rentalCashflows[0]?.amountUSD || 0;
        const role = (contract.property as any).role || 'OWNER';

        if (role === 'TENANT') rentalsTotalExpense += lastPayment;
        else rentalsTotalIncome += lastPayment;
    });

    // =========================================================================================
    // 5. BANK
    // =========================================================================================
    const bankOperations = await prisma.bankOperation.findMany({
        where: { userId },
        select: { currency: true, amount: true }
    });

    const bankTotalUSD = bankOperations
        .filter(op => op.currency === 'USD')
        .reduce((sum, op) => sum + op.amount, 0);

    // =========================================================================================
    // 6. CRYPTO
    // =========================================================================================
    const cryptoInvestments = await prisma.investment.findMany({
        where: { userId, type: 'CRYPTO', market: 'CRYPTO' },
        select: {
            id: true,
            lastPrice: true,
            transactions: { select: { type: true, quantity: true } }
        }
    });

    let cryptoTotalValue = 0;
    for (const crypto of cryptoInvestments) {
        const quantity = crypto.transactions.reduce((sum, tx) => {
            if (tx.type === 'BUY') return sum + tx.quantity;
            if (tx.type === 'SELL') return sum - tx.quantity;
            return sum;
        }, 0);
        cryptoTotalValue += quantity * (crypto.lastPrice || 0);
    }

    const cryptoCount = cryptoInvestments.filter(c => {
        const qty = c.transactions.reduce((s, t) => t.type === 'BUY' ? s + t.quantity : s - t.quantity, 0);
        return qty > 0;
    }).length;

    // =========================================================================================
    // 7. COSTA ESMERALDA
    // =========================================================================================
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const costaStats = await prisma.costaTransaction.aggregate({
        where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startOfMonth, lte: endOfMonth }
        },
        _sum: { amount: true }
    });

    const costaTotalMonthly = costaStats._sum.amount || 0;
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMonthName = monthNames[now.getMonth()];

    // =========================================================================================
    // 8. BARBOSA (HOGAR)
    // =========================================================================================
    const barbosaStats = await prisma.barbosaTransaction.aggregate({
        where: {
            userId,
            type: 'EXPENSE',
            date: { gte: startOfMonth, lte: endOfMonth },
            isStatistical: false
        },
        _sum: { amountUSD: true }
    });

    const barbosaTotalMonthly = barbosaStats._sum.amountUSD || 0;

    return {
        needsOnboarding: settings && settings.enabledSections === '',
        enabledSections,
        userEmail: user.email,
        on: {
            count: activeOnCount,
            totalInvested: onMarketValueUSD
        },
        treasury: {
            count: treasuryCount,
            totalInvested: treasuryTotalInvested
        },
        debts: {
            count: debts.length,
            totalPending
        },
        rentals: {
            count: contracts.length,
            totalValue: rentalsTotalIncome,
            totalIncome: rentalsTotalIncome,
            totalExpense: rentalsTotalExpense
        },
        bank: {
            totalUSD: bankTotalUSD,
            nextMaturitiesPF: []
        },
        crypto: {
            count: cryptoCount,
            totalValue: cryptoTotalValue
        },
        barbosa: {
            totalMonthly: barbosaTotalMonthly,
            label: 'Mes Actual',
            monthName: currentMonthName
        },
        costa: {
            totalMonthly: costaTotalMonthly,
            label: 'Mes Actual',
            monthName: currentMonthName
        }
    };
}
