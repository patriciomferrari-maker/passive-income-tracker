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

        // 3. Map & Merge with Deduplication
        const existingTickers = new Set(investments.map(i => i.ticker));

        const globalAssets = holdings
            .filter(h => !existingTickers.has(h.asset.ticker)) // Deduplicate: Don't show Global Asset if Legacy Investment exists
            .map(h => ({
                id: h.asset.id,
                ticker: h.asset.ticker,
                name: h.asset.name,
                type: h.asset.type,
                currency: h.asset.currency,
                market: h.asset.market,
                userId,
                amortizationSchedules: [],
                transactions: [],
                _count: { transactions: 0 },
                isGlobal: true
            }));

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

        // Check if exists in Global Catalog
        const globalCheck = await prisma.globalAsset.findFirst({
            where: { ticker }
        });

        if (globalCheck) {
            return NextResponse.json(
                { error: `El activo ${ticker} ya existe en el Catálogo Global. Úsalo directamente desde la lista.` },
                { status: 400 }
            );
        }

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
