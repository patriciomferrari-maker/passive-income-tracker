import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Timeframe: Custom Range from Nov 2025 (Data Inception) + 12 Months Projection
        // User requested: "Graph from Nov-25 onwards"
        // USE UTC to ensure consistent bucketing regardless of server/local timezone
        const startDate = new Date(Date.UTC(2025, 10, 1)); // Nov 1 2025 00:00 UTC
        const endDate = new Date(Date.UTC(2026, 10, 0, 23, 59, 59)); // Oct 31 2026

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

        // --- DATA PROCESSING ---

        // 1. Trend Data (Last 12 Months)
        const monthlyData: Record<string, { income: number; expense: number; expenseCosta: number; incomeUSD: number; expenseUSD: number; expenseCostaUSD: number; savingsUSD: number; date: Date }> = {};

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
                date: new Date(Date.UTC(y, m, 1, 12, 0, 0))
            };
            current.setUTCMonth(current.getUTCMonth() + 1);
        }

        let totalSavingsUSD12M = 0;
        const lastMonthKey = `${endDate.getFullYear()}-${(endDate.getMonth() + 1).toString().padStart(2, '0')}`;
        const lastMonthExpenses: Record<string, number> = {};

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
                    if (!isStatistical || tx.status === 'PROJECTED') {
                        monthlyData[key].income += amount;
                        monthlyData[key].incomeUSD += amountUSD;
                    }
                } else {
                    // EXPENSE
                    if (!isStatistical || tx.status === 'PROJECTED') {
                        monthlyData[key].expense += amount;
                        monthlyData[key].expenseUSD += amountUSD;

                        if (isCosta) {
                            monthlyData[key].expenseCosta += amount;
                            monthlyData[key].expenseCostaUSD += amountUSD;
                        }
                    }

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
            const savings = val.income - val.expense;
            const savingsUSD = val.incomeUSD - val.expenseUSD;
            const expenseOtherUSD = val.expenseUSD - val.expenseCostaUSD;

            totalSavingsUSD12M += savingsUSD;

            return {
                period: key, // "2024-01"
                shortDate: val.date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase(),
                date: val.date,
                income: val.income,
                expense: val.expense,
                expenseCostaUSD: val.expenseCostaUSD,
                expenseOtherUSD: expenseOtherUSD,
                savings: savings,
                savingsUSD: savingsUSD,
                savingsRate: val.income > 0 ? (savings / val.income) * 100 : 0
            };
        });

        // 2. KPIs
        // Last finished month (or current if meaningful?)
        // Let's take the last available month in trend (which is current month usually)
        const lastMonth = trend[trend.length - 1];
        const lastMonthSavings = lastMonth ? lastMonth.savingsUSD : 0;
        const lastMonthSavingsRate = lastMonth && lastMonth.income > 0 ? (lastMonth.savings / lastMonth.income) * 100 : 0;

        // Average Monthly Savings (USD)
        const avgSavingsUSD = totalSavingsUSD12M / 12;

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
