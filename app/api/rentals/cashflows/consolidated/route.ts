import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();

        // Get all rental cashflows (consolidated) filtered by User's contracts
        const cashflows = await prisma.rentalCashflow.findMany({
            where: {
                contract: { property: { userId } }
            },
            include: {
                contract: {
                    select: {
                        currency: true
                    }
                }
            },
            orderBy: {
                date: 'asc'
            }
        });

        if (cashflows.length === 0) {
            return NextResponse.json([]);
        }

        // Fetch rates for the entire range
        const firstDate = new Date(cashflows[0].date);
        const lastDate = new Date(cashflows[cashflows.length - 1].date);

        // Buffer for rates (previous month needed for first calc)
        const rateStartDate = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth() - 1, 1));
        const rateEndDate = new Date(lastDate);
        rateEndDate.setMonth(rateEndDate.getMonth() + 1);

        const rates = await prisma.economicIndicator.findMany({
            where: {
                type: 'TC_USD_ARS',
                date: {
                    gte: rateStartDate,
                    lte: rateEndDate
                }
            },
            orderBy: { date: 'asc' },
            select: { date: true, value: true }
        });

        // Helper to get rate for a target date (Last available rate <= targetDate)
        const getClosestRate = (targetDate: Date) => {
            let bestRate = null;
            for (const rate of rates) {
                if (rate.date <= targetDate) {
                    bestRate = rate.value;
                } else {
                    break;
                }
            }
            return bestRate;
        };

        // Aggregate by month using UTC to avoid timezone shifts
        const aggregated = cashflows.reduce((acc, cf) => {
            const date = new Date(cf.date);
            // Use UTC methods
            const year = date.getUTCFullYear();
            const month = date.getUTCMonth();
            const monthKey = `${year}-${String(month + 1).padStart(2, '0')}-01`;

            if (!acc[monthKey]) {
                acc[monthKey] = {
                    date: new Date(Date.UTC(year, month, 1, 12, 0, 0)), // Noon UTC to avoid date shifts
                    incomeARS: 0,
                    incomeUSD: 0,
                    totalUSD: 0,
                    count: 0
                };
            }

            // Amounts
            const valARS = cf.amountARS || 0;
            const valUSD = cf.amountUSD || 0;

            // Determine strict currency bucket based on contract
            if (cf.contract.currency === 'ARS') {
                acc[monthKey].incomeARS += valARS;

                // Calculate USD equivalent for this ARS amount
                // TC: Closing rate of PREVIOUS month
                const targetDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));
                const rate = getClosestRate(targetDate);

                if (rate && rate > 0) {
                    acc[monthKey].totalUSD += (valARS / rate);
                }
            } else {
                // USD Contract
                acc[monthKey].incomeUSD += valUSD;
                acc[monthKey].totalUSD += valUSD;
            }

            acc[monthKey].count++;
            return acc;
        }, {} as Record<string, any>);

        return NextResponse.json(Object.values(aggregated));
    } catch (error) {
        console.error('Error fetching consolidated cashflows:', error);
        return unauthorized();
    }
}
