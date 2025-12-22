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

        // Accumulate Category Total
        structure[type][catName].total[period] = (structure[type][catName].total[period] || 0) + amount;
    });

    // --- FETCH EXCHANGE RATES (Closing of Prev Month) ---
    // User Requirement: "El tipo de cambio a considerar es el de cierre del mes anterior"
    // So for Period "2024-05", we want the Closing Rate of "2024-04".

    // 1. Fetch Rates covering the range (starting 1 month before first period)
    const ratesStartDate = new Date(startDate);
    ratesStartDate.setMonth(ratesStartDate.getMonth() - 1);

    const dbRates = await prisma.economicIndicator.findMany({
        where: {
            type: 'TC_USD_ARS',
            date: { gte: ratesStartDate, lte: endDate }
        },
        orderBy: { date: 'asc' }
    });

    // 2. Map rates to Periods
    periodLabels.forEach(period => {
        // Parse Period "YYYY-MM"
        const [yStr, mStr] = period.split('-');
        const pYear = parseInt(yStr);
        const pMonth = parseInt(mStr); // 1-12

        // Determine Previous Month
        const prevDate = new Date(pYear, pMonth - 1, 1); // 1st of Current Month
        prevDate.setMonth(prevDate.getMonth() - 1); // 1st of Previous Month

        const targetYear = prevDate.getFullYear();
        const targetMonth = prevDate.getMonth(); // 0-11

        // Find relevant rates for that month
        const monthlyRates = dbRates.filter(r => {
            const rDate = new Date(r.date); // Ensure Date object
            // Adjust timezone offset if needed, but usually Date objects from Prism match UTC or Local correctly enough for Month/Year checks if stored as Date.
            // Be careful: r.date from Prisma is Date.
            return rDate.getFullYear() === targetYear && rDate.getMonth() === targetMonth;
        });

        if (monthlyRates.length > 0) {
            // Get the LAST one (Closing)
            const closingRate = monthlyRates[monthlyRates.length - 1]; // Sorted asc by query

            // User Requirement: Use Average of Buy and Sell
            if (closingRate.buyRate && closingRate.sellRate) {
                monthlyExchangeRates[period] = (closingRate.buyRate + closingRate.sellRate) / 2;
            } else {
                monthlyExchangeRates[period] = closingRate.value; // 'value' typically stores the average or single available rate
            }
        } else {
            // Fallback: Try finding closest before? Or existing from transactions?
            // If no rate found (e.g. data missing), maybe check if we have one from transactions as backup?
            // Actually, let's look for "most recent before this period" if 'closing' missing? 
            // Better to leave empty or try finding verify if gap.
            // For now, let's stick to strict "Previous Month" logic.
        }
    });

    // -------------------------------

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
