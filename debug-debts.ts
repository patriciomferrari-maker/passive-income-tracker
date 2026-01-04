
import { prisma } from './lib/prisma';

async function debug() {
    console.log('--- DEBUG DEBTS ---');

    // 1. Count Debt Types
    const debtCounts = await prisma.debt.groupBy({
        by: ['type', 'status'],
        _count: { _all: true }
    });
    console.log('Debt Counts:', debtCounts);

    // 2. Check Installment Plans
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        take: 5
    });
    console.log('Installment Plans (First 5):', plans.map(p => ({ desc: p.description, amount: p.totalAmount })));

    console.log('\n--- DEBUG TIMEZONES ---');
    // 3. Check Rental Cashflow Dates
    const cf = await prisma.rentalCashflow.findFirst({
        orderBy: { date: 'desc' }
    });
    if (cf) {
        console.log('Raw DB Date:', cf.date);
        console.log('ISO String:', cf.date.toISOString());
        // Simulate client-side parsing? Can't really do that here differently than Node.
    }
}

debug()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
