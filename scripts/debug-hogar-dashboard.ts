import { prisma } from '@/lib/prisma';

async function main() {
    const userId = 'cmixq96ww0000l8pp4w1zu2cy'; // Patricio
    console.log(`User: ${userId}`);

    // Simulate "Historic" view calculation which includes Nov 2025 if current date is Jan 2026?
    // Wait, metadata says current date is 2026-01-12.
    // Dashboard Logic:
    // History: startDate = 2025-01-12 - 1 year + margin = 2025-02-01?
    // Code: startDate = Date.UTC(currentYear - 1, currentMonth + 1, 1);
    // currentYear=2026, currentMonth=0. => 2025, 2 (Feb?) => Feb 1, 2025.
    // endDate = Date.UTC(2026, 1, 0) => Jan 31, 2026.

    // So range is Feb 2025 - Jan 2026.
    // Nov 2025 is included.

    const startDate = new Date(Date.UTC(2025, 10, 1)); // Nov 1, 2025
    const endDate = new Date(Date.UTC(2025, 10, 30, 23, 59, 59)); // End Nov 2025

    console.log('--- Checking Transactions for Nov 2025 ---');
    const txs = await prisma.barbosaTransaction.findMany({
        where: {
            userId,
            date: { gte: startDate, lte: endDate }
        },
        include: { category: true }
    });

    let totalIncome = 0;
    let totalIncomeUSD = 0;

    txs.forEach(tx => {
        if (tx.category.type === 'INCOME') {
            const amount = tx.amount;
            const rate = tx.exchangeRate || (tx.currency === 'ARS' ? 1150 : 1);
            const amountUSD = (tx.currency === 'USD') ? amount : (rate > 0 ? amount / rate : 0);

            console.log(`TX: ${tx.description} | ${tx.amount} ${tx.currency} | Rate: ${tx.exchangeRate} | FallbackRate: ${rate} | USD: ${amountUSD}`);
            totalIncome += amount;
            totalIncomeUSD += amountUSD;
        }
    });

    console.log('--- Checking Rental Cashflows for Nov 2025 ---');
    const cashflows = await prisma.rentalCashflow.findMany({
        where: {
            contract: { property: { userId } }, // Owner
            date: { gte: startDate, lte: endDate }
        },
        include: { contract: { include: { property: true } } }
    });

    cashflows.forEach(cf => {
        const amount = cf.amountARS || 0;
        const amountUSD = cf.amountUSD || 0;
        console.log(`CF: ${cf.date.toISOString()} | ARS: ${amount} | USD: ${amountUSD}`);
        totalIncome += amount;
        totalIncomeUSD += amountUSD;
    });

    console.log(`\nTOTAL NOV 2025: Income ARS=${totalIncome}, Income USD=${totalIncomeUSD}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
