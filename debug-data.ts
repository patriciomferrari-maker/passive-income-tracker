
import { prisma } from './lib/prisma';
import { getUserId } from './app/lib/auth-helper';

// Mock auth for script
async function mockGetUserId() {
    const user = await prisma.user.findFirst();
    return user?.id || '';
}

async function debug() {
    console.log('--- DEBUG START ---');
    const userId = await mockGetUserId();
    console.log(`User ID: ${userId}`);

    // 1. Check Rentals ARS Data
    console.log('\n[Rentals] Checking latest cashflows...');
    const cashflows = await prisma.rentalCashflow.findMany({
        take: 5,
        orderBy: { date: 'desc' },
        include: { contract: true }
    });

    cashflows.forEach(cf => {
        console.log(`Date: ${cf.date.toISOString().split('T')[0]}, Contract: ${cf.contractId.substr(0, 10)}..., USD: ${cf.amountUSD}, ARS: ${cf.amountARS}, TC: ${cf.tc}`);
    });

    const arsZeros = await prisma.rentalCashflow.count({ where: { amountARS: 0 } });
    const totalCf = await prisma.rentalCashflow.count();
    console.log(`\nStats: ${arsZeros} / ${totalCf} cashflows have 0 ARS.`);


    // 2. Check Payable Debts Logic (Replicating Global Route)
    console.log('\n[Global] Checking Debt Logic...');

    // Fetch Installment Plans (Barbosa) - as they seem to be the source of "Debts"
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: { userId },
        include: { transactions: true }
    });

    let totalPending = 0; // Receivables
    let totalPayable = 0; // Payables

    plans.forEach(plan => {
        const totalAmount = plan.totalAmount || 0;
        // Sum transactions
        const paid = plan.transactions.reduce((sum, t) => sum + (t.amountUSD || 0), 0);

        // This logic depends on what the plan represents.
        // Assuming plan.type or ownership implies direction? 
        // Let's print the plans to see structure.
        console.log(`Plan: ${plan.description}, Total: ${totalAmount}, Paid: ${paid}, Type: ${plan.type || 'N/A'}`);
    });

    // Also check "Debts" from manual debt tracking if exists?
    // The previous code mentioned `payablesList`. Let's see what that was based on.

    console.log('--- DEBUG END ---');
}

debug()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
