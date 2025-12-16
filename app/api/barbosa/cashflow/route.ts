import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    // 1. Fetch ALL transactions for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    const txs = await prisma.barbosaTransaction.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: endDate }
        },
        include: {
            category: true,
            subCategory: true
        }
    });

    // 2. Structure Data
    // We need:
    // - Month Columns (0-11)
    // - Rows: Grouped by Type -> Category -> SubCategory

    const structure: Record<string, any> = {
        INCOME: {},
        EXPENSE: {}
    };

    const monthlyExchangeRates: Record<number, number> = {};
    // We could calculate avg exchange rate from transactions that have it, 
    // OR fetch from EconomicIndicator if we had it. 
    // For now, let's avg the implied rates in transactions (amount / amountUSD) or explicit rate.

    // Initialize structure helpers
    const getMonth = (date: Date) => date.getMonth() + 1; // 1-12

    txs.forEach(tx => {
        const type = tx.category.type; // INCOME or EXPENSE
        const catName = tx.category.name;
        const subName = tx.subCategory?.name || 'General';
        const month = getMonth(tx.date);
        const amount = tx.amount;
        const amountUSD = tx.amountUSD || 0;

        // Init Category
        if (!structure[type][catName]) structure[type][catName] = { total: {}, subs: {} };

        // Init SubCategory
        if (!structure[type][catName].subs[subName]) structure[type][catName].subs[subName] = {};

        // Accumulate SubCategory
        structure[type][catName].subs[subName][month] = (structure[type][catName].subs[subName][month] || 0) + amount;

        // Accumulate Category
        structure[type][catName].total[month] = (structure[type][catName].total[month] || 0) + amount;

        // Accumulate Exchange Rate Stats (Weighted? Or just simple avg of entries?)
        // Let's rely on manual entries of 'exchangeRate' for now.
        if (tx.exchangeRate) {
            if (!monthlyExchangeRates[month]) monthlyExchangeRates[month] = tx.exchangeRate;
            // If multiple, maybe average? Let's overwrite for now or use last.
            // Ideally we want the rate of the month.
        }
    });

    // Flatten for UI
    // Returns: { income: [...], expenses: [...], summary: { net: {}, usd: {} } }

    return NextResponse.json({
        year,
        data: structure,
        rates: monthlyExchangeRates
    });
}
