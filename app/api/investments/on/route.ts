import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all ONs
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();
        const investments = await prisma.investment.findMany({
            where: {
                // type: { in: ['ON', 'CORPORATE_BOND', 'CEDEAR', 'ETF'] }, // Removing broad type filter or adding market filter
                // We want specifically Argentina Portfolio items.
                market: 'ARG',
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
        console.error('Error fetching ONs:', error);
        return unauthorized();
    }
}

// POST create new ON
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { type, ticker, name, emissionDate, couponRate, frequency, maturityDate, amortization, amortizationSchedules } = body;

        const investment = await prisma.investment.create({
            data: {
                userId,
                ticker,
                name,
                type: type || 'ON', // Default to ON if not specified
                market: 'ARG', // Explicitly Argentina Portfolio
                currency: ['CEDEAR', 'ETF'].includes(type) ? 'ARS' : 'ARS', // Usually ARS for Arg Portfolio
                emissionDate: emissionDate ? new Date(emissionDate) : null,
                couponRate: couponRate ? parseFloat(couponRate) : null,
                frequency: frequency ? parseInt(frequency) : null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
                amortization: amortization || 'BULLET',
                amortizationSchedules: amortizationSchedules && amortization === 'PERSONALIZADA' ? {
                    create: amortizationSchedules.map((schedule: any) => ({
                        paymentDate: new Date(schedule.paymentDate),
                        percentage: parseFloat(schedule.percentage)
                    }))
                } : undefined
            },
            include: {
                amortizationSchedules: true
            }
        });

        return NextResponse.json(investment);
    } catch (error) {
        console.error('Error creating ON:', error);
        return unauthorized();
    }
}
