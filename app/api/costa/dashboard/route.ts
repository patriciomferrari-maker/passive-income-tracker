import { getUserId, unauthorized } from '@/app/lib/auth-helper';

// ...


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

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonthKey = format(now, 'yyyy-MM');

        // Helper to convert to USD
        const toUSD = (amount: number, currency: string) => {
            if (currency === 'USD') return amount;
            return amount / FETCH_TC;
        };

        let yearlyRentalIncomeUSD = 0;
        let totalExpensesAllTimeUSD = 0;

        const monthlyExpenses = new Map<string, number>();
        const expenseCategoriesLastMonth = new Map<string, number>();

        // Find "Last Month" with data. 
        // We look for the most recent month that has expenses.
        let lastExpenseMonthKey = '';
        const distinctExpenseMonths = new Set<string>();

        transactions.forEach(t => {
            const amountUSD = toUSD(t.amount, t.currency);
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

        // Last Month Expenses (using the identified last active month for expenses)
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
                const amountUSD = toUSD(t.amount, t.currency);
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
            const amountUSD = toUSD(t.amount, t.currency);
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
                // Create date using local time constructor to ensure 'format' doesn't shift it
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
                lastMonthName, // ADDED
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
