import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserId } from '@/app/lib/auth-helper';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Timeframe: Last 12 Months for Trends
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
        const startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);

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

        // --- DATA PROCESSING ---

        // 1. Trend Data (Last 12 Months)
        const monthlyData: Record<string, { income: number; expense: number; incomeUSD: number; expenseUSD: number; savingsUSD: number; date: Date }> = {};

        // Init months
        let current = new Date(startDate);
        while (current <= endDate) {
            const y = current.getFullYear();
            const m = current.getMonth();
            const key = `${y}-${(m + 1).toString().padStart(2, '0')}`;
            monthlyData[key] = { income: 0, expense: 0, incomeUSD: 0, expenseUSD: 0, savingsUSD: 0, date: new Date(y, m, 1) };
            current.setMonth(current.getMonth() + 1);
        }

        let totalSavingsUSD12M = 0;
        const categoryExpenses: Record<string, number> = {};

        txs.forEach(tx => {
            const key = `${tx.date.getFullYear()}-${(tx.date.getMonth() + 1).toString().padStart(2, '0')}`;
            const amount = tx.amount;
            const rate = tx.exchangeRate || 0; // We might need to fetch rates if not in TX, but assuming TX has it for simplicity or 0

            // If we don't have rate on TX, we can't calc USD precisely per TX without a lookup map. 
            // For dashboard speed, let's use what we have or skip USD if rate missing.
            const amountUSD = rate > 0 ? amount / rate : 0;

            if (monthlyData[key]) {
                if (tx.category.type === 'INCOME') {
                    monthlyData[key].income += amount;
                    monthlyData[key].incomeUSD += amountUSD;
                } else {
                    monthlyData[key].expense += amount;
                    monthlyData[key].expenseUSD += amountUSD;

                    // Category Breakdown (Overall last 12m? Or last month?)
                    // Let's do Last 12M Breakdown for better significance
                    categoryExpenses[tx.category.name] = (categoryExpenses[tx.category.name] || 0) + amountUSD; // USD distribution is better for comparison
                }
            }
        });

        // Finalize Trend Data
        const trend = Object.entries(monthlyData).sort().map(([key, val]) => {
            const savings = val.income - val.expense;
            const savingsUSD = val.incomeUSD - val.expenseUSD;
            totalSavingsUSD12M += savingsUSD;

            return {
                period: key, // "2024-01"
                shortDate: val.date.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase(),
                date: val.date,
                income: val.income,
                expense: val.expense,
                savings: savings,
                savingsUSD: savingsUSD
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

        // 3. Category Distribution (Top 5)
        const categoryDist = Object.entries(categoryExpenses)
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

    } catch (error) {
        console.error("Dashboard Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
