
import { prisma } from './lib/prisma';
import { getUserId } from './app/lib/auth-helper';

async function main() {
    console.log('--- MASTER DEBUG ---');

    const user = await prisma.user.findUnique({ where: { email: 'patriciomferrari@gmail.com' } });
    if (!user) throw new Error('No user found');
    console.log(`User: ${user.email}`);

    // 1. Check Settings & Visibility
    const settings = await prisma.appSettings.findUnique({ where: { userId: user.id } });
    console.log('Settings:', settings);

    // 2. Check "Ghost" Installments (Duplicates)
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: {
            userId: user.id,
            description: { in: ['Cerini', 'Abono Racing', 'Buzo Adidas', 'Regalo Tomy', 'Regalo sofi'] }
        },
        select: { id: true, description: true, totalAmount: true, createdAt: true, transactions: true }
    });

    console.log(`[DEBUG] Found ${plans.length} suspects. Dumping:`);
    plans.forEach(p => console.log(`${p.id} | ${p.description} | ${p.totalAmount} | TxCount: ${p.transactions.length}`));

    // Simple duplicate check
    const map = new Map();
    plans.forEach(p => {
        const key = `${p.description.toLowerCase().trim()}-${p.totalAmount}`;
        if (!map.has(key)) map.set(key, 0);
        map.set(key, map.get(key) + 1);
    });

    console.log('\n[Installments] Potential Duplicates (Key: Count):');
    for (const [key, count] of map.entries()) {
        if (count > 1) console.log(`  "${key}": ${count}`);
    }

    // 3. Check Debt Calculation (Payables)
    const exchangeRate = 1200; // Mock rate or fetch real one
    const pendingPlans = await prisma.barbosaInstallmentPlan.findMany({
        where: { userId: user.id },
        include: { transactions: true }
    });

    let totalPayable = 0;
    pendingPlans.forEach(p => {
        const paid = p.transactions.reduce((sum, t) => sum + Math.abs(t.amountUSD || 0), 0);
        // WAIT: amountUSD in transaction might be null or computed differently.
        // Let's use the Plan total vs Count paid
        const paidTx = p.transactions.filter(t => t.status === 'REAL').length;
        const paidAmt = (p.totalAmount / p.installmentsCount) * paidTx;
        const remaining = p.totalAmount - paidAmt;

        if (remaining > 1) {
            console.log(`  Plan: ${p.description}, Remaining ARS: ${remaining}, In USD (~1200): ${remaining / 1200}`);
            totalPayable += remaining;
        }
    });
    console.log(`[Debts] Total Payable ARS: ${totalPayable}, USD: ${totalPayable / exchangeRate}`);

    // 4. Rentals ARS
    const now = new Date();
    // Start of month in UTC
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));

    console.log(`\n[Rentals] Checking Range: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

    const cashflows = await prisma.rentalCashflow.findMany({
        where: {
            date: {
                gte: startOfMonth,
                lte: endOfMonth
            }
        }
    });

    console.log(`Found ${cashflows.length} cashflows for current month (UTC matching).`);
    cashflows.forEach(cf => {
        console.log(`  Date: ${cf.date.toISOString()}, ARS: ${cf.amountARS}, USD: ${cf.amountUSD}`);
    });

}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
