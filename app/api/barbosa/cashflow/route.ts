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
        const isStatistical = tx.isStatistical;

        // Init Category
        if (!structure[type][catName]) structure[type][catName] = {
            total: {},
            totalStatistical: {},
            subs: {},
            subsStatistical: {}
        };

        // Init SubCategory
        if (!structure[type][catName].subs[subName]) structure[type][catName].subs[subName] = {};
        if (!structure[type][catName].subsStatistical[subName]) structure[type][catName].subsStatistical[subName] = {};

        // Accumulate
        if (isStatistical) {
            // Category Total Statistical
            structure[type][catName].totalStatistical[period] = (structure[type][catName].totalStatistical[period] || 0) + amount;
            // Subcategory Statistical
            structure[type][catName].subsStatistical[subName][period] = (structure[type][catName].subsStatistical[subName][period] || 0) + amount;
        } else {
            // Category Total Real
            structure[type][catName].total[period] = (structure[type][catName].total[period] || 0) + amount;
            // Subcategory Real
            structure[type][catName].subs[subName][period] = (structure[type][catName].subs[subName][period] || 0) + amount;
        }
    });

    // --- FETCH EXCHANGE RATES (Closing of Prev Month) ---
    const ratesStartDate = new Date(startDate);
    ratesStartDate.setMonth(ratesStartDate.getMonth() - 1);

    const dbRates = await prisma.economicIndicator.findMany({
        where: {
            type: 'TC_USD_ARS',
            date: { gte: ratesStartDate, lte: endDate }
        },
        orderBy: { date: 'asc' }
    });

    periodLabels.forEach(period => {
        const [yStr, mStr] = period.split('-');
        const pYear = parseInt(yStr);
        const pMonth = parseInt(mStr);

        const prevDate = new Date(pYear, pMonth - 1, 1);
        prevDate.setMonth(prevDate.getMonth() - 1);

        const targetYear = prevDate.getFullYear();
        const targetMonth = prevDate.getMonth();

        const monthlyRates = dbRates.filter(r => {
            const rDate = new Date(r.date);
            return rDate.getFullYear() === targetYear && rDate.getMonth() === targetMonth;
        });

        if (monthlyRates.length > 0) {
            const closingRate = monthlyRates[monthlyRates.length - 1];
            if (closingRate.buyRate && closingRate.sellRate) {
                monthlyExchangeRates[period] = (closingRate.buyRate + closingRate.sellRate) / 2;
            } else {
                monthlyExchangeRates[period] = closingRate.value;
            }
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
        const amount = Math.round(cf.amountARS || 0);

        const role = (cf.contract.property as any).role || 'OWNER';
        const type = role === 'TENANT' ? 'EXPENSE' : 'INCOME';

        const catName = 'Alquileres';
        const subName = cf.contract.property.name || 'General';

        if (!structure[type][catName]) structure[type][catName] = {
            total: {},
            totalStatistical: {},
            subs: {},
            subsStatistical: {}
        };

        if (!structure[type][catName].subs[subName]) structure[type][catName].subs[subName] = {};

        structure[type][catName].subs[subName][period] = (structure[type][catName].subs[subName][period] || 0) + amount;
        structure[type][catName].total[period] = (structure[type][catName].total[period] || 0) + amount;
    });

    return NextResponse.json({
        year: paramYear,
        mode,
        periods: periodLabels,
        data: structure,
        rates: monthlyExchangeRates
    });
}
