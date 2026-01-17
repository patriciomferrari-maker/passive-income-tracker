import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function testDebtIncomeCalculation() {
    console.log('🧪 Testing Debt Income Calculation Fix\n');

    const userId = 'cmixpqcnk00003mnmljva12cg'; // Patricio's ID

    // Test for December 2024
    const testDate = new Date('2024-12-15');
    const start = startOfMonth(testDate);
    const end = endOfMonth(testDate);

    console.log(`📅 Testing period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\n`);

    // Get ALL debt payments (old logic)
    const allDebtPayments = await prisma.debtPayment.findMany({
        where: {
            debt: { userId },
            date: { gte: start, lte: end },
            type: 'PAYMENT'
        },
        include: { debt: true }
    });

    // Get ONLY OWED_TO_ME debt payments (new logic)
    const owedToMePayments = await prisma.debtPayment.findMany({
        where: {
            debt: {
                userId,
                type: 'OWED_TO_ME'
            },
            date: { gte: start, lte: end },
            type: 'PAYMENT'
        },
        include: { debt: true }
    });

    console.log('📊 OLD LOGIC (incorrect):');
    console.log(`   Total payments: ${allDebtPayments.length}`);
    allDebtPayments.forEach(p => {
        console.log(`   - ${p.debt.debtorName}: $${p.amount} (${p.debt.type})`);
    });
    const oldTotal = allDebtPayments.reduce((acc, p) => acc + p.amount, 0);
    console.log(`   ❌ Total shown as income: $${oldTotal.toFixed(2)}\n`);

    console.log('✅ NEW LOGIC (correct):');
    console.log(`   Total payments (OWED_TO_ME only): ${owedToMePayments.length}`);
    owedToMePayments.forEach(p => {
        console.log(`   - ${p.debt.debtorName}: $${p.amount} (${p.debt.type})`);
    });
    const newTotal = owedToMePayments.reduce((acc, p) => acc + p.amount, 0);
    console.log(`   ✅ Total shown as income: $${newTotal.toFixed(2)}\n`);

    // Show what was excluded
    const excludedPayments = allDebtPayments.filter(p => p.debt.type === 'I_OWE');
    if (excludedPayments.length > 0) {
        console.log('🚫 EXCLUDED (I_OWE - money paid, not income):');
        excludedPayments.forEach(p => {
            console.log(`   - ${p.debt.debtorName}: $${p.amount} (${p.debt.type})`);
        });
        const excludedTotal = excludedPayments.reduce((acc, p) => acc + p.amount, 0);
        console.log(`   Total excluded: $${excludedTotal.toFixed(2)}\n`);
    }

    console.log('📝 Summary:');
    console.log(`   Old calculation (wrong): $${oldTotal.toFixed(2)}`);
    console.log(`   New calculation (correct): $${newTotal.toFixed(2)}`);
    console.log(`   Difference: $${(oldTotal - newTotal).toFixed(2)}`);

    await prisma.$disconnect();
}

testDebtIncomeCalculation().catch(console.error);
