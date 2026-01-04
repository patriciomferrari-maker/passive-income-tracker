
import { prisma } from '../lib/prisma';

async function main() {
    console.log('--- DEEP DEBUG: Installments & Debts ---');
    const user = await prisma.user.findUnique({ where: { email: 'paato.ferrari@hotmail.com' } });

    if (!user) throw new Error('User not found');
    console.log(`User: ${user.email} (${user.id})`);

    // 1. Fetch Exchange Rate
    const latestExchangeRate = await prisma.economicIndicator.findFirst({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'desc' }
    });
    const exchangeRate = latestExchangeRate?.value || 1160;
    console.log(`Exchange Rate used: ${exchangeRate}`);

    // 2. Analyze Installment Plans (Hogar)
    const plans = await prisma.barbosaInstallmentPlan.findMany({
        where: { userId: user.id },
        include: { transactions: true }
    });

    console.log(`\n--- Installment Plans (${plans.length}) ---`);
    console.log('ID | Description | Total ARS | Paid ARS | Remaining ARS | Remaining USD | Txs | Created');

    let totalInstallmentDebtUSD = 0;

    plans.forEach(p => {
        // Calculate Paid Amount
        const paid = p.transactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
        const remaining = Math.max(0, p.totalAmount - paid);
        let remainingUSD = 0;

        if (remaining > 1) { // Filter out dust
            if (p.currency === 'ARS') {
                remainingUSD = remaining / exchangeRate;
            } else {
                remainingUSD = remaining;
            }
            totalInstallmentDebtUSD += remainingUSD;
        }

        console.log(`${p.id} | ${p.description.padEnd(20)} | $${p.totalAmount.toFixed(0)} | $${paid.toFixed(0)} | $${remaining.toFixed(0)} | $${remainingUSD.toFixed(2)} | ${p.transactions.length} | ${p.createdAt.toISOString().split('T')[0]}`);
    });

    console.log(`\n>>> Total Debt from Installments: $${totalInstallmentDebtUSD.toFixed(2)} USD`);

    // 3. Analyze Other Debts (Deudas module)
    const debts = await prisma.debt.findMany({
        where: { userId: user.id },
        include: { payments: true }
    });

    console.log(`\n--- Other Debts (${debts.length}) ---`);
    let totalOtherDebtUSD = 0;

    debts.forEach(d => {
        if (d.type === 'I_OWE') {
            const paid = d.payments.filter(p => !p.type || p.type === 'PAYMENT').reduce((sum, p) => sum + p.amount, 0);
            const increased = d.payments.filter(p => p.type === 'INCREASE').reduce((sum, p) => sum + p.amount, 0);
            const pending = (d.initialAmount + increased) - paid;

            let amountUSD = pending;
            if (d.currency === 'ARS') amountUSD /= exchangeRate;

            totalOtherDebtUSD += amountUSD;
            console.log(`[I_OWE] ${d.name}: Pending $${pending.toFixed(0)} (${d.currency}) -> $${amountUSD.toFixed(2)} USD`);
        }
    });

    console.log(`\n>>> Total Debt from Loans: $${totalOtherDebtUSD.toFixed(2)} USD`);
    console.log(`\n======> TOTAL SHOWN IN DASHBOARD: $${(totalInstallmentDebtUSD + totalOtherDebtUSD).toFixed(2)} USD <======`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
