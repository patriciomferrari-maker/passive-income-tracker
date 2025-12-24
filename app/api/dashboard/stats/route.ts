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



        const exchangeRate = 1160; // Hardcoded for now to avoid economicIndicator query
        const costaExchangeRate = 1160;

        // Get ON investments with FIFO calculation (matching detailed dashboard)
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON', userId, market: 'ARG' },
            select: {
                id: true,
                lastPrice: true,
                type: true,
                ticker: true,
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

        let onMarketValue = 0;
        for (const inv of onInvestments) {
            const fifoTxs = inv.transactions.map(t => ({
                id: t.id,
                date: new Date(t.date),
                type: t.type as 'BUY' | 'SELL',
                quantity: t.quantity,
                price: t.price,
                commission: t.commission,
                currency: t.currency
            }));

            const result = calculateFIFO(fifoTxs, inv.ticker);
            let currentPrice = priceMap[inv.id] || inv.lastPrice || 0;

            // ON prices are quoted per 100
            if (inv.type === 'ON') {
                currentPrice = currentPrice / 100;
            }

            result.openPositions.forEach(p => {
                const cost = (p.quantity * p.buyPrice) + p.buyCommission;
                const value = p.quantity * currentPrice;
                if (currentPrice > 0) {
                    onMarketValue += value;
                }
            });
        }

        const onCount = onInvestments.length;

        // Get Treasury investments
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

        // Get Debts
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

        // Get Rentals
        const contracts = await prisma.contract.findMany({
            where: { property: { userId } },
            select: {
                rentalCashflows: {
                    orderBy: { date: 'desc' },
                    take: 1,
                    select: {
                        amountUSD: true
                    }
                }
            }
        });

        const rentalsCount = contracts.length;
        const rentalsTotalValue = contracts.reduce((sum, contract) => {
            const lastPayment = contract.rentalCashflows[0];
            return sum + (lastPayment?.amountUSD || 0);
        }, 0);

        // Get Bank Stats
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

        const needsOnboarding = settings && settings.enabledSections === '';

        return NextResponse.json({
            needsOnboarding,
            enabledSections,
            userEmail: user?.email,
            on: {
                count: onCount,
                totalInvested: onMarketValue
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
                nextMaturitiesPF: []
            },
            barbosa: {
                count: 0,
                totalMonthly: 0,
                label: 'Mes Actual',
                monthName: 'Diciembre'
            },
            costa: {
                count: 0,
                totalMonthly: 0,
                label: 'Mes Actual',
                monthName: 'Diciembre'
            }
        });
    } catch (error: any) {
        console.error('CRITICAL ERROR in /api/dashboard/stats:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
