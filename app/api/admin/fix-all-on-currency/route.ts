import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

/**
 * FIX ALL ON CASHFLOW CURRENCY
 * 
 * Problem: All ON/CORPORATE_BOND cashflows have amounts in USD but currency field set to 'ARS'
 * This causes incorrect division by exchange rate when viewing
 * 
 * Solution: Update ALL ON/CORPORATE_BOND cashflows to have currency = 'USD'
 */
export async function POST(request: Request) {
    try {
        const userId = await getUserId();

        // Find all ON and CORPORATE_BOND investments
        const onInvestments = await prisma.investment.findMany({
            where: {
                userId,
                type: {
                    in: ['ON', 'CORPORATE_BOND']
                }
            },
            select: {
                id: true,
                ticker: true,
                type: true
            }
        });

        if (onInvestments.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No ON or CORPORATE_BOND investments found',
                updated: 0
            });
        }

        const investmentIds = onInvestments.map(inv => inv.id);

        // Update all cashflows for these investments to USD
        const result = await prisma.cashflow.updateMany({
            where: {
                investmentId: {
                    in: investmentIds
                }
            },
            data: {
                currency: 'USD'
            }
        });

        return NextResponse.json({
            success: true,
            investments: onInvestments.map(inv => inv.ticker),
            totalInvestments: onInvestments.length,
            cashflowsUpdated: result.count,
            message: `Updated ${result.count} cashflows for ${onInvestments.length} ON/Corporate Bond investments to USD`
        });
    } catch (error) {
        console.error('Error fixing ON currencies:', error);
        return unauthorized();
    }
}

/**
 * GET - Check current status
 */
export async function GET(request: Request) {
    try {
        const userId = await getUserId();

        const onInvestments = await prisma.investment.findMany({
            where: {
                userId,
                type: {
                    in: ['ON', 'CORPORATE_BOND']
                }
            },
            include: {
                cashflows: {
                    select: {
                        currency: true
                    }
                }
            }
        });

        const summary = onInvestments.map(inv => {
            const currencyCounts = inv.cashflows.reduce((acc: any, cf) => {
                acc[cf.currency] = (acc[cf.currency] || 0) + 1;
                return acc;
            }, {});

            return {
                ticker: inv.ticker,
                type: inv.type,
                totalCashflows: inv.cashflows.length,
                currencyBreakdown: currencyCounts,
                needsFix: currencyCounts['ARS'] > 0
            };
        });

        const totalNeedingFix = summary.filter(s => s.needsFix).length;

        return NextResponse.json({
            totalONs: onInvestments.length,
            investmentsNeedingFix: totalNeedingFix,
            summary
        });
    } catch (error) {
        console.error('Error checking ON currencies:', error);
        return unauthorized();
    }
}
