
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
    // Initialize defaults to prevent one failure from crashing the entire dashboard
    let onData = { count: 0, totalInvested: 0 };
    let treasuryData = { count: 0, totalInvested: 0 };
    let debtData = { count: 0, totalPending: 0 };
    let rentalData = { count: 0, totalValue: 0, totalIncome: 0, totalExpense: 0 };
    let bankData = { totalUSD: 0, nextMaturitiesPF: [] as any[] };
    let cryptoData = { count: 0, totalValue: 0 };
    let costaData = { totalMonthly: 0, label: 'Mes Actual', monthName: '' };
    let barbosaData = { totalMonthly: 0, label: 'Mes Actual', monthName: '' };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const currentMonthName = monthNames[now.getMonth()];

    // Helper for safe execution
    const safeExec = async (name: string, fn: () => Promise<void>) => {
        try {
            await fn();
        } catch (error) {
            console.error(`[Dashboard Error] Failed to load ${name}:`, error);
            // We swallow the error so other sections can proceed
        }
    };

    await Promise.allSettled([
        // 1. CARTERA ARGENTINA
        safeExec('Argentina Investments', async () => {
            const onInvestments = await prisma.investment.findMany({
                where: { userId, market: 'ARG' },
                select: {
                    id: true, lastPrice: true, type: true, ticker: true, currency: true,
                    transactions: { select: { id: true, date: true, type: true, quantity: true, price: true, commission: true, currency: true } }
                }
            });

            // Optimisation: Fetch prices in batch
            const onIds = onInvestments.map(i => i.id);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentPrices = await prisma.assetPrice.findMany({
                where: { investmentId: { in: onIds }, date: { gte: weekAgo } },
                orderBy: { date: 'desc' }
            });
            const priceMap: Record<string, number> = {};
            recentPrices.forEach(p => { if (!priceMap[p.investmentId]) priceMap[p.investmentId] = p.price; });

            const { calculateFIFO } = await import('@/app/lib/fifo');
            let onMarketValueUSD = 0;
            let activeOnCount = 0;

            for (const inv of onInvestments) {
                const fifoTxs = inv.transactions.map(t => ({
                    id: t.id, date: new Date(t.date), type: (t.type || '').toUpperCase() as 'BUY' | 'SELL',
                    quantity: t.quantity, price: t.price, commission: t.commission, currency: t.currency
                }));
                const result = calculateFIFO(fifoTxs, inv.ticker);
                let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

                if ((inv.type === 'ON' || inv.type === 'CORPORATE_BOND') && currentPrice > 2.0) currentPrice = currentPrice / 100;

                let instrumentValue = 0;
                let totalHeld = 0;
                result.openPositions.forEach(p => {
                    instrumentValue += p.quantity * currentPrice;
                    totalHeld += p.quantity;
                });

                if (totalHeld > 0) {
                    onMarketValueUSD += instrumentValue;
                    activeOnCount++;
                }
            }
            onData = { count: activeOnCount, totalInvested: onMarketValueUSD };
        }),

        // 2. TREASURY
        safeExec('Treasury', async () => {
            const treasuryInvestments = await prisma.investment.findMany({
                where: { type: 'TREASURY', userId },
                select: { transactions: { select: { totalAmount: true } } }
            });
            const treasuryTotalInvested = treasuryInvestments.reduce((sum, inv) => {
                return sum + inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
            }, 0);
            treasuryData = { count: treasuryInvestments.length, totalInvested: treasuryTotalInvested };
        }),

        // 3. DEBTS
        safeExec('Debts', async () => {
            const debts = await prisma.debt.findMany({
                where: { userId },
                select: { initialAmount: true, type: true, payments: { select: { amount: true, type: true } } }
            });

            const totalPending = debts.reduce((sum, d) => {
                const paid = d.payments.filter(p => !p.type || p.type === 'PAYMENT').reduce((pSum, p) => pSum + p.amount, 0);
                const increased = d.payments.filter(p => p.type === 'INCREASE').reduce((pSum, p) => pSum + p.amount, 0);
                const pending = (d.initialAmount + increased) - paid;
                return d.type === 'I_OWE' ? sum - pending : sum + pending;
            }, 0);
            debtData = { count: debts.length, totalPending };
        }),

        // 4. RENTALS
        safeExec('Rentals', async () => {
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
            rentalData = { count: contracts.length, totalValue: rentalsTotalIncome, totalIncome: rentalsTotalIncome, totalExpense: rentalsTotalExpense };
        }),

        // 5. BANK
        safeExec('Bank', async () => {
            const bankOperations = await prisma.bankOperation.findMany({
                where: { userId },
                select: { currency: true, amount: true, type: true, startDate: true, durationDays: true, tna: true, alias: true }
            });

            // Calculate Totals separated by Category (Converting ARS to USD)
            let liquidityUSD = 0;
            let investedPF_USD = 0;
            let investedFCI_USD = 0;

            bankOperations.forEach(op => {
                let amountUSD = op.amount;
                if (op.currency === 'ARS') {
                    amountUSD = op.amount / exchangeRate;
                }

                if (op.type === 'PLAZO_FIJO') {
                    // For PF, maybe show Capital, or Capital + Accrued Interest?
                    // Usually "Invested" implies Capital. 
                    // Let's stick to Principal Amount for now to match "Total Invested" concept efficiently.
                    investedPF_USD += amountUSD;
                } else if (op.type === 'FCI') {
                    investedFCI_USD += amountUSD;
                } else {
                    // Everything else (Caja Ahorro, Cuenta Corriente, Cash) = Liquidity
                    liquidityUSD += amountUSD;
                }
            });

            // Legacy Total (now sum of all USD equivalents?) or just Liquidity?
            // To be safe for existing consumers that might expect "Total Money in Bank", we sum them?
            // But the user requested "Bank" to be "Everything minus PF/FCI".
            // So we'll set totalUSD to liquidityUSD for new purposes, but be aware.
            // Actually, let's pass all 3.

            const bankTotalUSD = liquidityUSD;

            // Calculate Next Maturities for PF
            const today = new Date();
            const nextMaturitiesPF = bankOperations
                .filter(op => op.type === 'PLAZO_FIJO' && op.startDate)
                .map(op => {
                    const start = new Date(op.startDate!);
                    const end = new Date(start);
                    end.setDate(start.getDate() + (op.durationDays || 30));

                    const interest = (op.amount * (op.tna || 0) / 100) * ((op.durationDays || 30) / 365);
                    const total = op.amount + interest;
                    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    return {
                        daysLeft,
                        date: end.toLocaleDateString(), // String format for UI/Email
                        amount: total,
                        interest: interest, // Added
                        capital: op.amount, // Added
                        alias: op.alias || 'Plazo Fijo',
                        rawDate: end // Keep raw date for sorting/filtering
                    };
                })
                .filter(m => m.daysLeft >= 0) // Only future or today
                .sort((a, b) => a.daysLeft - b.daysLeft);

            bankData = {
                totalUSD: bankTotalUSD, // Now represents 'Liquidity'
                nextMaturitiesPF,
                // @ts-ignore - dynamic extension
                investedPF_USD,
                // @ts-ignore
                investedFCI_USD
            };
        }),

        // 6. CRYPTO
        safeExec('Crypto', async () => {
            const cryptoInvestments = await prisma.investment.findMany({
                where: { userId, type: 'CRYPTO', market: 'CRYPTO' },
                select: { id: true, lastPrice: true, transactions: { select: { type: true, quantity: true } } }
            });
            let cryptoTotalValue = 0;
            let cryptoCount = 0;
            for (const crypto of cryptoInvestments) {
                const quantity = crypto.transactions.reduce((sum, tx) => {
                    if (tx.type === 'BUY') return sum + tx.quantity;
                    if (tx.type === 'SELL') return sum - tx.quantity;
                    return sum;
                }, 0);
                cryptoTotalValue += quantity * (crypto.lastPrice || 0);
                if (quantity > 0) cryptoCount++;
            }
            cryptoData = { count: cryptoCount, totalValue: cryptoTotalValue };
        }),

        // 7. COSTA ESMERALDA
        safeExec('Costa', async () => {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const costaStats = await prisma.costaTransaction.aggregate({
                where: { userId, type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth } },
                _sum: { amount: true }
            });
            costaData = { totalMonthly: costaStats._sum.amount || 0, label: 'Mes Actual', monthName: currentMonthName };
        }),

        // 8. BARBOSA
        safeExec('Barbosa', async () => {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            const barbosaStats = await prisma.barbosaTransaction.aggregate({
                where: { userId, type: 'EXPENSE', date: { gte: startOfMonth, lte: endOfMonth }, isStatistical: false },
                _sum: { amountUSD: true }
            });
            barbosaData = { totalMonthly: barbosaStats._sum.amountUSD || 0, label: 'Mes Actual', monthName: currentMonthName };
        })
    ]);

    return {
        needsOnboarding: settings && settings.enabledSections === '',
        enabledSections,
        userEmail: user.email,
        on: onData,
        treasury: treasuryData,
        debts: debtData,
        rentals: rentalData,
        bank: bankData,
        crypto: cryptoData,
        barbosa: barbosaData,
        costa: costaData
    };
}
