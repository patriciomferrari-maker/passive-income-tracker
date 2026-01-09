import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

/**
 * FIX DNC3D CASHFLOW CURRENCY
 * 
 * Problem: DNC3D cashflows have amounts in USD but currency field set to 'ARS'
 * This causes double conversion when viewing in USD
 * 
 * Solution: Update all DNC3D cashflows to have currency = 'USD'
 */
export async function POST(request: Request) {
    try {
        const userId = await getUserId();

        // Find DNC3D investment
        const dnc3d = await prisma.investment.findFirst({
            where: {
                userId,
                ticker: 'DNC3D'
            }
        });

        if (!dnc3d) {
            return NextResponse.json({ error: 'DNC3D not found' }, { status: 404 });
        }

        // Update all cashflows for DNC3D to USD
        const result = await prisma.cashflow.updateMany({
            where: {
                investmentId: dnc3d.id
            },
            data: {
                currency: 'USD'
            }
        });

        return NextResponse.json({
            success: true,
            investment: dnc3d.ticker,
            cashflowsUpdated: result.count,
            message: `Updated ${result.count} cashflows for ${dnc3d.ticker} to USD`
        });
    } catch (error) {
        console.error('Error fixing DNC3D currency:', error);
        return unauthorized();
    }
}

/**
 * GET - Check current status
 */
export async function GET(request: Request) {
    try {
        const userId = await getUserId();

        const dnc3d = await prisma.investment.findFirst({
            where: {
                userId,
                ticker: 'DNC3D'
            },
            include: {
                cashflows: {
                    select: {
                        id: true,
                        date: true,
                        amount: true,
                        currency: true,
                        type: true
                    }
                }
            }
        });

        if (!dnc3d) {
            return NextResponse.json({ error: 'DNC3D not found' }, { status: 404 });
        }

        const currencyCounts = dnc3d.cashflows.reduce((acc: any, cf) => {
            acc[cf.currency] = (acc[cf.currency] || 0) + 1;
            return acc;
        }, {});

        return NextResponse.json({
            investment: {
                ticker: dnc3d.ticker,
                currency: dnc3d.currency
            },
            totalCashflows: dnc3d.cashflows.length,
            currencyBreakdown: currencyCounts,
            sampleCashflows: dnc3d.cashflows.slice(0, 3)
        });
    } catch (error) {
        console.error('Error checking DNC3D currency:', error);
        return unauthorized();
    }
}
