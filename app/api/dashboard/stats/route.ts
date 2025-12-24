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

        // Get ON investments with transactions
        const onInvestments = await prisma.investment.findMany({
            where: { type: 'ON', userId },
            select: {
                id: true,
                lastPrice: true,
                type: true,
                transactions: {
                    select: {
                        type: true,
                        quantity: true,
                        totalAmount: true
                    }
                }
            }
        });

        const onCount = onInvestments.length;
        const onTotalInvested = onInvestments.reduce((sum, inv) => {
            const quantityHeld = inv.transactions.reduce((qSum, tx) => {
                if (tx.type === 'BUY') return qSum + tx.quantity;
                if (tx.type === 'SELL') return qSum - tx.quantity;
                return qSum;
            }, 0);
            const price = inv.lastPrice || 0;
            let priceInUSD = price > 500 ? price / exchangeRate : price;
            if (inv.type === 'ON') priceInUSD = priceInUSD / 100;
            return sum + (quantityHeld * priceInUSD);
        }, 0);

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
