import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// GET all US Treasuries
export async function GET() {
    try {
        const investments = await prisma.investment.findMany({
            where: { type: 'TREASURY' },
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
        console.error('Error fetching Treasuries:', error);
        return NextResponse.json({ error: 'Failed to fetch Treasuries' }, { status: 500 });
    }
}

// POST create new Treasury
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ticker, name, emissionDate, couponRate, frequency, maturityDate } = body;

        const investment = await prisma.investment.create({
            data: {
                ticker,
                name,
                type: 'TREASURY',
                currency: 'USD',
                emissionDate: emissionDate ? new Date(emissionDate) : null,
                couponRate: couponRate ? parseFloat(couponRate) : null,
                frequency: frequency ? parseInt(frequency) : null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
                amortization: 'BULLET', // Treasuries are typically bullet
            }
        });

        return NextResponse.json(investment);
    } catch (error) {
        console.error('Error creating Treasury:', error);
        return NextResponse.json({ error: 'Failed to create Treasury' }, { status: 500 });
    }
}
