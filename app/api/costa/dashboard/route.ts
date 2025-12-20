
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { getUserId, unauthorized } from '@/app/lib/auth-helper';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const userId = await getUserId();

        const transactions = await prisma.costaTransaction.findMany({
            where: { userId },
            include: { category: true }
        });
        const notes = await prisma.costaNote.findMany({
            where: { userId }
        });

        // --- DYNAMIC RATES LOGIC START ---
        // Fetch all TC_USD_ARS logic (similar to CashflowTab)
        const rates = await prisma.economicIndicator.findMany({
            where: { type: 'TC_USD_ARS' },
            orderBy: { date: 'asc' }
        });

        const mepIndicator = await prisma.economicIndicator.findFirst({
            where: { type: 'TC_dollar_mep' },
            orderBy: { date: 'desc' }
        });
        const fallbackRate = mepIndicator?.value || 1160;

        // Map: 'yyyy-MM' -> rate (using UTC substring to avoid timezone shift)
        const rateMap: Record<string, number> = {};
        rates.forEach(r => {
            const key = r.date.toISOString().substring(0, 7);
            if (!rateMap[key]) rateMap[key] = r.value;
        });

        // Helper to convert to USD with Date Context
        const toUSD = (amount: number, currency: string, date: Date) => {
            if (currency === 'USD' || !amount) return amount;

            const key = date.toISOString().substring(0, 7);
            const rate = rateMap[key] || fallbackRate;

            return amount / rate;
        };
        // --- DYNAMIC RATES LOGIC END ---

        const now = new Date();
        const currentYear = now.getFullYear();

        let yearlyRentalIncomeUSD = 0;
        let totalExpensesAllTimeUSD = 0;

        const monthlyExpenses = new Map<string, number>();
        const expenseCategoriesLastMonth = new Map<string, number>();

        // Find "Last Month" with data. 
        let lastExpenseMonthKey = '';
        const distinctExpenseMonths = new Set<string>();

        transactions.forEach(t => {
            const amountUSD = toUSD(t.amount, t.currency, t.date);
            const monthKey = format(t.date, 'yyyy-MM');

            if (t.type === 'INCOME') {
                if (t.category?.name.toLowerCase().includes('alquiler') && t.date.getFullYear() === currentYear) {
                    yearlyRentalIncomeUSD += amountUSD;
                }
            } else if (t.type === 'EXPENSE') {
                totalExpensesAllTimeUSD += amountUSD;
                monthlyExpenses.set(monthKey, (monthlyExpenses.get(monthKey) || 0) + amountUSD);
                distinctExpenseMonths.add(monthKey);

                if (!lastExpenseMonthKey || monthKey > lastExpenseMonthKey) {
                    lastExpenseMonthKey = monthKey;
                }
            }
        });

        // Last Month Expenses
        let lastMonthExpensesUSD = 0;
        let lastMonthName = '';

        if (lastExpenseMonthKey) {
            lastMonthExpensesUSD = monthlyExpenses.get(lastExpenseMonthKey) || 0;
            const [y, m] = lastExpenseMonthKey.split('-');
            const date = new Date(parseInt(y), parseInt(m) - 1);
            lastMonthName = format(date, 'MMMM', { locale: es });
            lastMonthName = lastMonthName.charAt(0).toUpperCase() + lastMonthName.slice(1);

            // Build Distribution for this month
            transactions.filter(t => t.type === 'EXPENSE' && format(t.date, 'yyyy-MM') === lastExpenseMonthKey).forEach(t => {
                const amountUSD = toUSD(t.amount, t.currency, t.date);
                const catName = t.category?.name || 'Otros';
                expenseCategoriesLastMonth.set(catName, (expenseCategoriesLastMonth.get(catName) || 0) + amountUSD);
            });
        }

        // Average Expenses
        const monthsCount = distinctExpenseMonths.size || 1;
        const averageMonthlyExpenses = totalExpensesAllTimeUSD / monthsCount;

        const pendingFixes = notes.filter(n => n.category === 'FIX' && n.status === 'PENDING').length;
        const pendingItems = notes.filter(n => n.category === 'BRING' && n.status === 'PENDING').length;

        // Main Chart Data (Monthly Income vs Expense in USD)
        const monthlyData = new Map<string, { income: number; expense: number }>();

        transactions.forEach(t => {
            const amountUSD = toUSD(t.amount, t.currency, t.date);
            const key = format(t.date, 'yyyy-MM');
            if (!monthlyData.has(key)) monthlyData.set(key, { income: 0, expense: 0 });

            const current = monthlyData.get(key)!;
            if (t.type === 'INCOME') current.income += amountUSD;
            if (t.type === 'EXPENSE') current.expense += amountUSD;
        });

        const chartData = Array.from(monthlyData.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12) // Last 12 months
            .map(([key, vals]) => {
                const [y, m] = key.split('-');
                const date = new Date(parseInt(y), parseInt(m) - 1);
                return {
                    month: format(date, 'MMM yyyy', { locale: es }),
                    income: Math.round(vals.income),
                    expense: Math.round(vals.expense)
                };
            });

        // Expense Pie Chart Data
        const expenseDistribution = Array.from(expenseCategoriesLastMonth.entries())
            .map(([name, value]) => ({ name, value: Math.round(value) }))
            .sort((a, b) => b.value - a.value);

        return NextResponse.json({
            stats: {
                yearlyRentalIncomeUSD: Math.round(yearlyRentalIncomeUSD),
                lastMonthExpenses: Math.round(lastMonthExpensesUSD),
                lastMonthName,
                averageMonthlyExpenses: Math.round(averageMonthlyExpenses),
                pendingFixes,
                pendingItems
            },
            chartData,
            expenseDistribution
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
}
