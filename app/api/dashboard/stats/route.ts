import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Check authentication directly to handle timezone errors gracefully
        let session;
        try {
            const { auth } = await import('@/auth');
            session = await auth();
        } catch (authError) {
            console.error('[Dashboard Stats] Auth check failed:', authError);
            // If auth itself fails (timezone or other issues), treat as unauthenticated
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        const now = new Date();

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true } // Only select what we need
        });

        // Get User Settings
        const settings = await prisma.appSettings.findUnique({
            where: { userId },
            select: { userId: true, enabledSections: true, reportDay: true, reportHour: true }
        });

        let enabledSections = settings?.enabledSections ? settings.enabledSections.split(',') : [];

        // STRICT ACCESS CONTROL
        // Only allow 'barbosa' and 'costa' for the specific admin email
        const ADMIN_EMAIL = 'patriciomferrari@gmail.com';
        if (user?.email !== ADMIN_EMAIL) {
            enabledSections = enabledSections.filter(s => s !== 'barbosa' && s !== 'costa' && s !== 'costa-esmeralda');
        }


        // Fetch latest Exchange Rate (TC_USD_ARS) - Blue Dollar
        const latestExchangeRate = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'desc' }
        });

        // Use scanned rate or fallback to 1160 if database is empty
        const exchangeRate = latestExchangeRate?.value || 1160;
        const costaExchangeRate = 1160;

        // =========================================================================================
        // 1. CARTERA ARGENTINA (ONs, CEDEARs, ETFs)
        // =========================================================================================

        // Get ON investments
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

        // Get recent prices for ONs
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
            // Shape transactions for FIFO
            const fifoTxs = inv.transactions.map(t => ({
                id: t.id,
                date: new Date(t.date),
                type: (t.type || '').toUpperCase() as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                commission: t.commission,
                currency: t.currency
            }));

            // Calculate FIFO
            const result = calculateFIFO(fifoTxs, inv.ticker);

            // Calculate Value from Open Positions
            // Logic must match Inner Dashboard exactly
            let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

            // Normalization for ONs
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
                // Currency Conversion - DISABLED TO MATCH INNER DASHBOARD (which sums raw values)
                // if (inv.currency === 'ARS') {
                //    instrumentValue = instrumentValue / exchangeRate;
                // }

                onMarketValueUSD += instrumentValue;
                activeOnCount++;
            }
        }

        const onCount = activeOnCount;


        // =========================================================================================
        // 2. TREASURY (Cartera USA)
        // =========================================================================================
        const treasuryInvestments = await prisma.investment.findMany({
            where: { type: 'TREASURY', userId },
            select: {
                transactions: {
                    select: {
                        totalAmount: true
                    }
                }
            }
        });

        const treasuryCount = treasuryInvestments.length;
        const treasuryTotalInvested = treasuryInvestments.reduce((sum, inv) => {
            const total = inv.transactions.reduce((txSum, tx) => txSum + Math.abs(tx.totalAmount), 0);
            return sum + total;
        }, 0);


        // =========================================================================================
        // 3. DEBTS (Deudas a Cobrar)
        // =========================================================================================
        const debts = await prisma.debt.findMany({
            where: { userId },
            select: {
                initialAmount: true,
                payments: {
                    select: {
                        amount: true
                    }
                }
            }
        });

        const debtsCount = debts.length;
        const totalPending = debts.reduce((sum, d) => {
            const paid = d.payments.reduce((pSum, p) => pSum + p.amount, 0);
            return sum + (d.initialAmount - paid);
        }, 0);


        // =========================================================================================
        // 4. RENTALS (Alquileres) - FIXED
        // =========================================================================================
        // Strategy: Query properties first, then contracts. Safer than nested query which caused Vercel errors.

        // 1. Get IDs of consolidated properties
        const consolidatedProperties = await prisma.property.findMany({
            where: {
                userId,
                isConsolidated: true
            },
            select: { id: true }
        });

        const consolidatedPropIds = consolidatedProperties.map(p => p.id);
        // const now = new Date(); // Need actual date for filtering - already defined at top

        // 2. Fetch active contracts for these properties
        const contracts = await prisma.contract.findMany({
            where: {
                propertyId: { in: consolidatedPropIds }
            },
            select: {
                property: {
                    select: { role: true }
                },
                rentalCashflows: {
                    where: {
                        date: { lte: now } // Only consider current or past cashflows
                    },
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        amountUSD: true
                    }
                }
            }
        });

        const rentalsCount = contracts.length;

        let rentalsTotalIncome = 0;
        let rentalsTotalExpense = 0;

        contracts.forEach(contract => {
            const lastPayment = contract.rentalCashflows[0]?.amountUSD || 0;
            const role = (contract.property as any).role || 'OWNER';

            if (role === 'TENANT') {
                rentalsTotalExpense += lastPayment;
            } else {
                rentalsTotalIncome += lastPayment;
            }
        });


        // =========================================================================================
        // 5. BANK
        // =========================================================================================
        const bankOperations = await prisma.bankOperation.findMany({
            where: { userId },
            select: {
                currency: true,
                amount: true
            }
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
                transactions: {
                    select: {
                        type: true,
                        quantity: true,
                        price: true,
                        commission: true
                    }
                }
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
            const qty = c.transactions.reduce((sum, tx) => {
                if (tx.type === 'BUY') return sum + tx.quantity;
                if (tx.type === 'SELL') return sum - tx.quantity;
                return sum;
            }, 0);
            return qty > 0;
        }).length;


        // =========================================================================================
        // 7. COSTA ESMERALDA - FIXED
        // =========================================================================================

        // Calculate current month's expenses
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // We use aggregate to sum amounts
        const costaStats = await prisma.costaTransaction.aggregate({
            where: {
                userId,
                type: 'EXPENSE',
                date: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            _sum: {
                amount: true
            }
        });

        const costaTotalMonthly = costaStats._sum.amount || 0;
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const currentMonthName = monthNames[now.getMonth()];

        const needsOnboarding = settings && settings.enabledSections === '';

        return NextResponse.json({
            needsOnboarding,
            enabledSections,
            userEmail: user?.email,
            on: {
                count: onCount,
                totalInvested: onMarketValueUSD // Uses the converted value
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
                totalValue: rentalsTotalIncome, // Only count Owner Income for the main dashboard total
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
                count: 0,
                totalMonthly: 0,
                label: 'Mes Actual',
                monthName: currentMonthName
            },
            costa: {
                count: 0,
                totalMonthly: costaTotalMonthly,
                label: 'Mes Actual',
                monthName: currentMonthName
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/dashboard/stats:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
