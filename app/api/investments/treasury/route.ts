import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all US Treasuries AND ETFs
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();
        const investments = await prisma.investment.findMany({
            where: {
                type: { in: ['TREASURY', 'ETF'] },
                userId
            },
            include: {
                amortizationSchedules: {
                    orderBy: { paymentDate: 'asc' }
                },
                transactions: true,
                _count: {
                    select: { transactions: true }
                }
            },
            orderBy: { ticker: 'asc' }
        });

        return NextResponse.json(investments);
    } catch (error) {
        console.error('Error fetching Investments:', error);
        return unauthorized();
    }
}

// POST create new Treasury or ETF
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { ticker, name, type, emissionDate, couponRate, frequency, maturityDate } = body;

        // Default to TREASURY if type is not provided for backward compatibility
        const investmentType = type || 'TREASURY';

        const investment = await prisma.investment.create({
            data: {
                userId,
                ticker,
                name,
                type: investmentType,
                currency: 'USD',
                emissionDate: emissionDate ? new Date(emissionDate) : null,
                couponRate: couponRate ? parseFloat(couponRate) : null,
                frequency: frequency ? parseInt(frequency) : null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
                amortization: investmentType === 'TREASURY' ? 'BULLET' : null,
            }
        });

        return NextResponse.json(investment);
    } catch (error) {
        console.error('Error creating Treasury:', error);
        return unauthorized();
    }
}
