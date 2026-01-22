import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all ONs
export const dynamic = 'force-dynamic';
export async function GET() {
    try {
        const userId = await getUserId();

        // 1. Fetch Legacy Investments
        const investments = await prisma.investment.findMany({
            where: {
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

        // 2. Fetch Global Assets (User Holdings)
        const holdings = await prisma.userHolding.findMany({
            where: {
                userId,
                asset: { market: 'ARG' }
            },
            include: {
                asset: true
            }
        });

        // 3. Map & Merge
        const globalAssets = holdings.map(h => ({
            id: h.asset.id, // Using Asset ID for selection. The Transaction API must handle this.
            ticker: h.asset.ticker,
            name: h.asset.name,
            type: h.asset.type,
            currency: h.asset.currency,
            market: h.asset.market,
            userId,
            amortizationSchedules: [],
            transactions: [], // We could fetch GlobalAssetTransactions here?
            _count: { transactions: 0 },
            isGlobal: true // Flag to help frontend or debugging
        }));

        // Filter out duplicates if any (though they shouldn't overlap by ID, but maybe by ticker?)
        // If a user has "AAPL" as Investment AND as GlobalAsset, we might show both.
        // For now, let's just merge.

        return NextResponse.json([...investments, ...globalAssets].sort((a, b) => a.ticker.localeCompare(b.ticker)));
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
