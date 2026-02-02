import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // View Toggle: 'history' (default) vs 'projected'
        const { searchParams } = new URL(req.url);
        const view = searchParams.get('view') || 'history';
        const paramStartDate = searchParams.get('startDate');

        const now = new Date();
        const currentYear = now.getUTCFullYear();
        const currentMonth = now.getUTCMonth(); // 0-11

        let startDate, endDate;

        if (view === 'projected') {
            // Future: From current month to 12 months ahead
            startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
            endDate = new Date(Date.UTC(currentYear + 1, currentMonth, 0, 23, 59, 59));
        } else {
            // History: Last 12 months (inclusive of current)
            // e.g., if Now is Nov 2025, show Dec 2024 -> Nov 2025
            startDate = new Date(Date.UTC(currentYear - 1, currentMonth + 1, 1));

            endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59));
        }

        if (paramStartDate) {
            const userStart = new Date(paramStartDate);
            // Ensure UTC midnight for comparison
            const utcUserStart = new Date(Date.UTC(userStart.getFullYear(), userStart.getMonth(), userStart.getDate()));
            if (!isNaN(utcUserStart.getTime()) && utcUserStart > startDate) {
                startDate = utcUserStart;
            }
        }

        // Fetch Transactions
        const txs = await prisma.barbosaTransaction.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate }
            },
            include: {
                category: true
            },
            orderBy: { date: 'desc' }
        });

        // --- FETCH RENTAL CASHFLOWS ---
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

        // --- FETCH DOLLAR PURCHASES (MANUAL SAVINGS) ---
        const dollarPurchases = await prisma.dollarPurchase.findMany({
            where: {
                userId,
                date: { gte: startDate, lte: endDate }
            }
        });

        // --- DATA PROCESSING ---

        // 1. Trend Data (Last 12 Months)
        const monthlyData: Record<string, {
            income: number;
            expense: number;
            expenseCosta: number;
            incomeUSD: number;
            expenseUSD: number;
            expenseCostaUSD: number;
            savingsUSD: number;
            date: Date;
            categoryBreakdown: Record<string, number>; // USD
            categoryBreakdownARS: Record<string, number>; // ARS
            dollarPurchasesUSD: number; // New manual savings tracker
        }> = {};

        // Init months using UTC
        let current = new Date(startDate);
        while (current <= endDate) {
            const y = current.getUTCFullYear();
            const m = current.getUTCMonth(); // 0-11
            const key = `${y}-${(m + 1).toString().padStart(2, '0')}`;
            monthlyData[key] = {
                income: 0,
                expense: 0,
                expenseCosta: 0,
                incomeUSD: 0,
                expenseUSD: 0,
                expenseCostaUSD: 0,
                savingsUSD: 0,
                // Store date as UTC Noon for safe display formatting
                date: new Date(Date.UTC(y, m, 1, 12, 0, 0)),
                categoryBreakdown: {},
                categoryBreakdownARS: {},
                dollarPurchasesUSD: 0
            };
            current.setUTCMonth(current.getUTCMonth() + 1);
        }

        let totalSavingsUSD12M = 0; // Will be calculated from DollarPurchases
        const lastMonthKey = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const lastMonthExpenses: Record<string, number> = {};

        // Process Dollar Purchases (Manual Savings)
        let totalDollarPurchases = 0;
        dollarPurchases.forEach(dp => {
            const key = `${dp.date.getUTCFullYear()}-${(dp.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
            if (monthlyData[key]) {
                monthlyData[key].dollarPurchasesUSD += dp.amount;
                totalDollarPurchases += dp.amount;
            }
        });

        // Use total from dollar purchases as the main 12M savings KPI
        totalSavingsUSD12M = totalDollarPurchases;

        txs.forEach(tx => {
            const key = `${tx.date.getUTCFullYear()}-${(tx.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
            const amount = tx.amount;
            // Fallback for Exchange Rate if missing: 1150 (approx current)
            const rate = tx.exchangeRate || (tx.currency === 'ARS' ? 1150 : 1);
            const amountUSD = (tx.currency === 'USD') ? amount : (rate > 0 ? amount / rate : 0);
            const isCosta = tx.category.name.toLowerCase().includes('costa esmeralda');

            // STATISTICAL CHECK:
            // If isStatistical is true, we DO NOT sum it to the Totals (Income/Expense/Savings)
            // But we DO keep it for Category Distribution analysis.
            const isStatistical = tx.isStatistical;

            if (monthlyData[key]) {
                if (tx.category.type === 'INCOME') {
                    // Income usually not statistical, but safe check
                    if (!isStatistical) {
                        monthlyData[key].income += amount;
                        monthlyData[key].incomeUSD += amountUSD;
                    }
                } else {
                    // EXPENSE
                    if (!isStatistical) {
                        monthlyData[key].expense += amount;
                        monthlyData[key].expenseUSD += amountUSD;

                        if (isCosta) {
                            monthlyData[key].expenseCosta += amount;
                            monthlyData[key].expenseCostaUSD += amountUSD;
                        }
                    }

                    // Always track category breakdown (including all statistical transactions)
                    const catName = tx.category.name;
                    monthlyData[key].categoryBreakdown[catName] = (monthlyData[key].categoryBreakdown[catName] || 0) + amountUSD;
                    monthlyData[key].categoryBreakdownARS[catName] = (monthlyData[key].categoryBreakdownARS[catName] || 0) + amount;

                    // Distribution: ALWAYS include in Last Month Expenses (Pie Chart)
                    // Allows analyzing "How much did I spend in Supermarket" regardless of payment method.
                    if (key === lastMonthKey) {
                        lastMonthExpenses[tx.category.name] = (lastMonthExpenses[tx.category.name] || 0) + amountUSD;
                    }
                }
            } else {
                console.warn(`Transaction date ${tx.date} generated key ${key} which is out of range.`);
            }
        });

        // Process Rental Cashflows
        rentalCashflows.forEach(cf => {
            const key = `${cf.date.getUTCFullYear()}-${(cf.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;

            // Should verify if key exists in monthlyData (it should because of date filter)
            if (monthlyData[key]) {
                const amount = cf.amountARS || 0;
                const amountUSD = cf.amountUSD || 0;
                const role = (cf.contract.property as any).role || 'OWNER';

                if (role === 'OWNER') {
                    // INCOME
                    monthlyData[key].income += amount;
                    monthlyData[key].incomeUSD += amountUSD;
                } else {
                    // EXPENSE (TENANT)
                    monthlyData[key].expense += amount;
                    monthlyData[key].expenseUSD += amountUSD;
                    // Note: We don't add to lastMonthExpenses here as it's not a category-based expense yet
                    // If user wants to see 'Alquileres' in distribution, we'd need to add it:
                    if (key === lastMonthKey) {
                        lastMonthExpenses['Alquileres'] = (lastMonthExpenses['Alquileres'] || 0) + amountUSD;
                    }
                }
            }
        });

        // Finalize Trend Data
        const trend = Object.entries(monthlyData).sort().map(([key, val]) => {
            // "Savings" in the trend chart (yellow line) -> Should this also be Dollar Purchases?
            // User requested: "Ahorro ultimo mes" and "Promedio ahorro/mes" (KPIs) to come from Dollars.
            // But what about the Chart?
            // "Evolución Ingresos y Ahorro" -> The 'Savings' bar usually implies (Income - Expense).
            // However, seeing "Dollars Bought" plotted against Income/Expense might be useful.
            // Let's stick to the EXPLICIT request first: KPIs.
            // But wait, if savings is disconnected from Income-Expense, the "Savings Rate" (yellow line) becomes (DollarsBought / Income).
            // That is actually a more accurate "Savings Rate" (real savings).
            // Let's use Dollar Purchases for the savings value in the trend data too, for consistency.

            // Previous Logic: const savings = val.income - val.expense;
            // New Logic:
            const savingsUSD = val.dollarPurchasesUSD; // Use manual dollar purchases
            const savings = val.dollarPurchasesUSD * 1150; // Approx ARS for graph consistency if needed, but we rely on USD mostly.
            // Note: If we use dollarPurchases for 'savings', we retain (Income - Expense) as 'surplus' maybe?
            // Let's adhere to the request: "Ahorro ... salgan de la seccion dolares".

            const expenseOtherUSD = val.expenseUSD - val.expenseCostaUSD;

            return {
                period: key,
                shortDate: val.date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase(),
                date: val.date,
                income: val.income,
                incomeUSD: val.incomeUSD,
                expense: val.expense,
                expenseUSD: val.expenseUSD,
                expenseCostaUSD: val.expenseCostaUSD,
                expenseOtherUSD: expenseOtherUSD,
                savings: savings,
                savingsUSD: savingsUSD,
                // Savings Rate = Dollar Purchases / Total Income
                savingsRate: val.incomeUSD > 0 ? (savingsUSD / val.incomeUSD) * 100 : 0
            };
        });

        // Fixed categories to track (no longer dynamic)
        const topCategories = ['Departamento', 'Auto', 'Comida', 'Ropa'];

        // Build the category trend array with both USD and ARS
        const categoryTrend = Object.entries(monthlyData).sort().map(([key, val]) => {
            const dataPoint: any = {
                period: key,
                shortDate: val.date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase(),
                date: val.date
            };
            topCategories.forEach(cat => {
                dataPoint[cat] = val.categoryBreakdown[cat] || 0;
                dataPoint[`${cat}_ARS`] = val.categoryBreakdownARS[cat] || 0;
            });
            return dataPoint;
        });

        // 2. KPIs
        // Last finished month
        // We look at the last entry in the trend (last month of range)
        const lastMonth = trend.find(t => t.period === lastMonthKey) || trend[trend.length - 1];

        const lastMonthSavings = lastMonth ? lastMonth.savingsUSD : 0;
        const lastMonthSavingsRate = lastMonth ? lastMonth.savingsRate : 0;

        // Average Monthly Savings (USD)
        const avgSavingsUSD = totalSavingsUSD12M / 12; // Simple 12m avg

        // 3. Category Distribution (Top 5 - Last Month Only)
        const categoryDist = Object.entries(lastMonthExpenses)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5

        // 4. Recent Activity (Last 5 transactions)
        const recentActivity = txs.slice(0, 5).map(tx => ({
            id: tx.id,
            date: tx.date,
            type: tx.category.type,
            category: tx.category.name,
            amount: tx.amount,
            currency: 'ARS', // Assuming base is ARS for now
            amountUSD: tx.exchangeRate ? tx.amount / tx.exchangeRate : null
        }));

        return NextResponse.json({
            kpis: {
                totalSavingsUSD12M,
                lastMonthSavingsUSD: lastMonthSavings,
                lastMonthSavingsRate,
                avgSavingsUSD
            },
            trend,
            categoryTrend, // NEW: for expense evolution chart
            topCategories, // NEW: category names for chart
            distribution: categoryDist,
            recentActivity
        });

    } catch (error: any) {
        console.error("Dashboard Error:", error);
        return NextResponse.json({
            error: error.message || 'Unknown Error',
            stack: error.stack,
            details: JSON.stringify(error)
        }, { status: 500 });
    }
}
