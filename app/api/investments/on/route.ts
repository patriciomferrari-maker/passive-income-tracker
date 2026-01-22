import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// GET all investments (generic or by market)
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
    try {
        const userId = await getUserId();
        const { searchParams } = new URL(request.url);
        const market = searchParams.get('market') || 'ARG';

        // 1. Fetch Legacy Investments
        const investments = await prisma.investment.findMany({
            where: {
                market: market,
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

        // 2. Fetch ALL Global Assets (Catalog)
        const allGlobalAssets = await prisma.globalAsset.findMany({
            where: {
                market: market
            }
        });

        // 3. Map & Merge with Deduplication
        const existingTickers = new Set(investments.map(i => i.ticker));

        const mappedGlobalAssets = allGlobalAssets
            .filter(a => !existingTickers.has(a.ticker)) // Deduplicate: Don't show Global Asset if Legacy Investment exists
            .map(a => ({
                id: a.id,
                ticker: a.ticker,
                name: a.name,
                type: a.type,
                currency: a.currency,
                market: a.market,
                userId, // Virtual association
                amortizationSchedules: [],
                transactions: [],
                _count: { transactions: 0 },
                isGlobal: true,
                lastPrice: a.lastPrice
            }));

        return NextResponse.json([...investments, ...mappedGlobalAssets].sort((a, b) => a.ticker.localeCompare(b.ticker)));
    } catch (error) {
        console.error('Error fetching Investments:', error);
        return unauthorized();
    }
}

// POST create new Investment
export async function POST(request: Request) {
    try {
        const userId = await getUserId();
        const body = await request.json();
        const { type, ticker, name, emissionDate, couponRate, frequency, maturityDate, amortization, amortizationSchedules, market } = body;

        const targetMarket = market || 'ARG';
        // Currency Logic:
        // US Market -> USD
        // ARG Market -> CEDEAR can be ARS (or USD/CCL?), ONs are ARS/USD.
        // For simplicity, if US -> USD.
        // If ARG:
        //   CEDEAR, ETF -> ARS (usually quoted in ARS on BYMA)
        //   ON -> ARS (or USD but we might track in USD? Usually we track ONs in USD or ARS. Let's default to ARS for now as per previous logic, but allow override if passed).

        let currency = 'ARS';
        if (targetMarket === 'US') currency = 'USD';
        else if (['CEDEAR', 'ETF'].includes(type) || ['ON', 'BONO'].includes(type)) {
            // For ARG ONs, we accepted existing logic. 
            // Previous code: `['CEDEAR', 'ETF'].includes(type) ? 'ARS' : 'ARS'`. So always ARS.
            currency = 'ARS';
        }

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
                type: type || 'ON',
                market: targetMarket,
                currency,
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
        console.error('Error creating Investment:', error);
        return unauthorized();
    }
}
