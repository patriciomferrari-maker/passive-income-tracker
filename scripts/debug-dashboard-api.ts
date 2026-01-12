import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userId = 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio

    // USE UTC
    const startDate = new Date(Date.UTC(2025, 10, 1)); // Nov 1 2025 00:00 UTC
    const endDate = new Date(Date.UTC(2026, 10, 0, 23, 59, 59)); // Oct 31 2026

    console.log('Range:', startDate.toISOString(), endDate.toISOString());

    // Fetch Transactions
    const txs = await prisma.barbosaTransaction.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: endDate }
        },
        include: { category: true },
        orderBy: { date: 'desc' }
    });

    // --- DATA PROCESSING ---
    const monthlyData: Record<string, any> = {};

    // Init months using UTC
    let current = new Date(startDate);
    while (current <= endDate) {
        const y = current.getUTCFullYear();
        const m = current.getUTCMonth();
        const key = `${y}-${(m + 1).toString().padStart(2, '0')}`;
        monthlyData[key] = {
            income: 0,
            expense: 0,
            incomeUSD: 0,
            expenseUSD: 0,
            savingsUSD: 0,
            date: new Date(Date.UTC(y, m, 1, 12, 0, 0))
        };
        current.setUTCMonth(current.getUTCMonth() + 1);
    }

    txs.forEach(tx => {
        const key = `${tx.date.getUTCFullYear()}-${(tx.date.getUTCMonth() + 1).toString().padStart(2, '0')}`;
        const amount = tx.amount;
        const rate = tx.exchangeRate || (tx.currency === 'ARS' ? 1150 : 1);
        const amountUSD = (tx.currency === 'USD') ? amount : (rate > 0 ? amount / rate : 0);

        const isStatistical = tx.isStatistical;

        if (monthlyData[key]) {
            if (tx.category.type === 'INCOME') {
                if (!isStatistical || tx.status === 'PROJECTED') {
                    monthlyData[key].income += amount;
                    monthlyData[key].incomeUSD += amountUSD;
                }
            } else {
                // EXPENSE
                if (!isStatistical || tx.status === 'PROJECTED') {
                    monthlyData[key].expense += amount;
                    monthlyData[key].expenseUSD += amountUSD;
                }
            }
        }
    });

    const trend = Object.entries(monthlyData).sort().map(([key, val]) => {
        const savingsUSD = val.incomeUSD - val.expenseUSD;
        return {
            period: key,
            incomeUSD: val.incomeUSD,
            expenseUSD: val.expenseUSD,
            savingsUSD: savingsUSD,
            savingsRate: val.income > 0 ? ((val.income - val.expense) / val.income) * 100 : 0
        };
    });

    console.log('--- TREND DATA ---'); // Inspect First 5
    console.table(trend.slice(0, 15));
}

main().catch(console.error).finally(() => prisma.$disconnect());
