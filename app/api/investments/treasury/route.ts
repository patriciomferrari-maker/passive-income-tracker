import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all US Treasuries
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();
        const investments = await prisma.investment.findMany({
            where: { type: 'TREASURY', userId },
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
        return unauthorized();
    }
}

// POST create new Treasury
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { ticker, name, emissionDate, couponRate, frequency, maturityDate } = body;

        const investment = await prisma.investment.create({
            data: {
                userId,
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
        return unauthorized();
    }
}
