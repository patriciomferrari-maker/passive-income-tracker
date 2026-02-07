import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

// Rent Split Configuration (starting March 2026)
const RENT_SPLIT_CONFIG = {
    startDate: new Date('2026-03-01'),
    users: {
        patricio: { email: 'paato.ferrari@hotmail.com', percentage: 0.75 },
        melina: { email: 'melina.llozano@gmail.com', percentage: 0.25 }
    },
    // Properties that participate in the split (by name)
    properties: ['Soldado', 'Ayres']
};

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user email for rent split logic
    const session = await auth();
    const userEmail = session?.user?.email;

    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'YEAR'; // 'YEAR' or 'LAST_12'
    const paramYear = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const paramStartDate = searchParams.get('startDate');

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

    if (paramStartDate) {
        const userStart = new Date(paramStartDate);
        if (!isNaN(userStart.getTime()) && userStart > startDate) {
            startDate = userStart;
        }
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

    // --- INSTALLMENT PLANS PROJECTION ---
    const activePlans = await prisma.barbosaInstallmentPlan.findMany({
        where: { userId },
        include: { category: true }
    });

    activePlans.forEach(plan => {
        let planDate = new Date(plan.startDate);
        for (let i = 0; i < plan.installmentsCount; i++) {
            // Check if this installment falls within requested window
            if (planDate >= startDate && planDate <= endDate) {
                const planPeriod = getPeriodKey(planDate);

                // Check if a REAL transaction exists for this plan in this month
                // We check existing loaded txs to avoid extra DB calls
                const realTxExists = txs.some(t =>
                    t.installmentPlanId === plan.id &&
                    getPeriodKey(t.date) === planPeriod
                );

                if (!realTxExists) {
                    // Inject Projected Amount
                    const type = 'EXPENSE'; // Plans are usually expenses
                    const catName = plan.category.name;
                    const subName = plan.subCategory?.name || 'General';
                    // Calculate individual installment amount if not stored explicitly?
                    // Schema has `totalAmount` and `installmentsCount`. 
                    // Usually we store totalAmount. Let's assume equal installments:
                    const amount = plan.totalAmount / plan.installmentsCount;

                    // Init Category/Sub if missing (reuse logic)
                    if (!structure[type][catName]) structure[type][catName] = {
                        total: {}, totalStatistical: {}, subs: {}, subsStatistical: {}
                    };
                    if (!structure[type][catName].subs[subName]) structure[type][catName].subs[subName] = {};

                    // Add to "Real" (Projected is treated as Real for Cashflow)
                    structure[type][catName].total[planPeriod] = (structure[type][catName].total[planPeriod] || 0) + amount;
                    structure[type][catName].subs[subName][planPeriod] = (structure[type][catName].subs[subName][planPeriod] || 0) + amount;
                }
            }
            // Advance 1 month
            planDate.setMonth(planDate.getMonth() + 1);
        }
    });

    // Track rent amounts for split calculation
    const rentSplitAmounts: Record<string, number> = {}; // period -> total rent for split properties

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

        // Track rent for split calculation (only for split properties, from March 2026+)
        const propertyName = cf.contract.property.name || '';
        const cfDate = new Date(cf.date);
        const isSplitProperty = RENT_SPLIT_CONFIG.properties.some(p => propertyName.includes(p));
        const isAfterSplitStart = cfDate >= RENT_SPLIT_CONFIG.startDate;

        if (isSplitProperty && isAfterSplitStart) {
            // For split calculation, we need the absolute amount (both income and expense contribute to split)
            rentSplitAmounts[period] = (rentSplitAmounts[period] || 0) + Math.abs(amount);
        }
    });

    // --- RENT SPLIT CONTRIBUTION INJECTION ---
    // Only for the two users involved, and only from March 2026+
    const isPatricio = userEmail === RENT_SPLIT_CONFIG.users.patricio.email;
    const isMelina = userEmail === RENT_SPLIT_CONFIG.users.melina.email;

    if (isPatricio || isMelina) {
        const contributionCatName = 'Ajuste Alquileres';

        // Determine contribution label based on which user is viewing
        const contributionSubName = isPatricio
            ? 'Contribución Melina (25%)'
            : 'Contribución Patricio (75%)';

        // Calculate contribution percentage (what the OTHER person contributes)
        const contributionPercentage = isPatricio
            ? RENT_SPLIT_CONFIG.users.melina.percentage  // Patricio receives 25% from Melina
            : RENT_SPLIT_CONFIG.users.patricio.percentage; // Melina receives 75% from Patricio

        Object.entries(rentSplitAmounts).forEach(([period, totalRent]) => {
            const contributionAmount = Math.round(totalRent * contributionPercentage);

            if (contributionAmount > 0) {
                // Init Category if needed
                if (!structure['INCOME'][contributionCatName]) {
                    structure['INCOME'][contributionCatName] = {
                        total: {},
                        totalStatistical: {},
                        subs: {},
                        subsStatistical: {}
                    };
                }

                if (!structure['INCOME'][contributionCatName].subs[contributionSubName]) {
                    structure['INCOME'][contributionCatName].subs[contributionSubName] = {};
                }

                // Add contribution as income
                structure['INCOME'][contributionCatName].subs[contributionSubName][period] =
                    (structure['INCOME'][contributionCatName].subs[contributionSubName][period] || 0) + contributionAmount;
                structure['INCOME'][contributionCatName].total[period] =
                    (structure['INCOME'][contributionCatName].total[period] || 0) + contributionAmount;
            }
        });
    }

    return NextResponse.json({
        year: paramYear,
        mode,
        periods: periodLabels,
        data: structure,
        rates: monthlyExchangeRates
    });
}

