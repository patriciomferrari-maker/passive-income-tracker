import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'YEAR'; // 'YEAR' or 'LAST_12'
    const paramYear = parseInt(searchParams.get('year') || new Date().getFullYear().toString());

    let startDate: Date;
    let endDate: Date;
    let periodLabels: string[] = []; // ["2024-01", "2024-02", ...]

    if (mode === 'LAST_12') {
        const today = new Date();
        // Set to first day of current month? Or strictly last 12 months ending today?
        // Usually "Last 12 Months" in reporting means "Current Month - 11" to "Current Month" (inclusive full months).
        // Let's go with full months.
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59); // End of current month
        startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1); // 1st of 11 months ago
    } else {
        startDate = new Date(paramYear, 0, 1);
        endDate = new Date(paramYear, 11, 31, 23, 59, 59);
    }

    // Generate expected Period Keys
    let current = new Date(startDate);
    while (current <= endDate) {
        const y = current.getFullYear();
        const m = (current.getMonth() + 1).toString().padStart(2, '0');
        periodLabels.push(`${y}-${m}`);
        current.setMonth(current.getMonth() + 1);
    }

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

    const structure: Record<string, any> = {
        INCOME: {},
        EXPENSE: {}
    };

    const monthlyExchangeRates: Record<string, number> = {};

    const getPeriodKey = (date: Date) => {
        const y = date.getFullYear();
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${y}-${m}`;
    };

    txs.forEach(tx => {
        const type = tx.category.type;
        const catName = tx.category.name;
        const subName = tx.subCategory?.name || 'General';
        const period = getPeriodKey(tx.date);
        const amount = tx.amount;

        // Init Category
        if (!structure[type][catName]) structure[type][catName] = { total: {}, subs: {} };

        // Init SubCategory
        if (!structure[type][catName].subs[subName]) structure[type][catName].subs[subName] = {};

        // Accumulate SubCategory
        structure[type][catName].subs[subName][period] = (structure[type][catName].subs[subName][period] || 0) + amount;

        // Accumulate Category
        structure[type][catName].total[period] = (structure[type][catName].total[period] || 0) + amount;

        if (tx.exchangeRate) {
            // Overwrite or avg? Simple overwrite for now logic
            if (!monthlyExchangeRates[period]) monthlyExchangeRates[period] = tx.exchangeRate;
        }
    });

    // --- RENTAL INCOME INJECTION ---
    const rentalCashflows = await prisma.rentalCashflow.findMany({
        where: {
            contract: {
                property: {
                    userId,
                    isConsolidated: true
                }
            },
            date: { gte: startDate, lte: endDate }
        },
        include: {
            contract: {
                include: { property: true }
            }
        }
    });

    rentalCashflows.forEach(cf => {
        const period = getPeriodKey(cf.date);
        const amount = Math.round(cf.amountARS || 0); // Use ARS amount, rounded to integer
        const catName = 'Alquileres';
        const subName = cf.contract.property.name || 'General';

        // Init Category
        if (!structure['INCOME'][catName]) structure['INCOME'][catName] = { total: {}, subs: {} };

        // Init SubCategory
        if (!structure['INCOME'][catName].subs[subName]) structure['INCOME'][catName].subs[subName] = {};

        // Accumulate (Rental Income is positive for us, so add it)
        structure['INCOME'][catName].subs[subName][period] = (structure['INCOME'][catName].subs[subName][period] || 0) + amount;
        structure['INCOME'][catName].total[period] = (structure['INCOME'][catName].total[period] || 0) + amount;
    });
    // -------------------------------

    return NextResponse.json({
        year: paramYear,
        mode,
        periods: periodLabels,
        data: structure,
        rates: monthlyExchangeRates
    });
}
