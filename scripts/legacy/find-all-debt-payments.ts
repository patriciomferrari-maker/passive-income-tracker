import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAllDebtPayments() {
    console.log('🔍 Finding ALL Debt Payments\n');

    const userId = 'cmixpqcnk00003mnmljva12cg'; // Patricio's ID

    // Get ALL debt payments ever
    const allPayments = await prisma.debtPayment.findMany({
        where: {
            debt: { userId }
        },
        include: { debt: true },
        orderBy: { date: 'desc' }
    });

    console.log(`Total debt payments found: ${allPayments.length}\n`);

    // Group by debt type
    const owedToMe = allPayments.filter(p => p.debt.type === 'OWED_TO_ME');
    const iOwe = allPayments.filter(p => p.debt.type === 'I_OWE');

    console.log('💰 OWED_TO_ME (Money Collected - Should show in email):');
    owedToMe.forEach(p => {
        console.log(`   ${p.date.toLocaleDateString()}: ${p.debt.debtorName} - $${p.amount} ${p.debt.currency}`);
    });
    console.log(`   Total: $${owedToMe.reduce((acc, p) => acc + p.amount, 0).toFixed(2)}\n`);

    console.log('💸 I_OWE (Money Paid - Should NOT show in email):');
    iOwe.forEach(p => {
        console.log(`   ${p.date.toLocaleDateString()}: ${p.debt.debtorName} - $${p.amount} ${p.debt.currency}`);
    });
    console.log(`   Total: $${iOwe.reduce((acc, p) => acc + p.amount, 0).toFixed(2)}\n`);

    // Look for the specific $5,982.67 payment
    const suspectPayment = allPayments.find(p => Math.abs(p.amount - 5982.67) < 0.01);
    if (suspectPayment) {
        console.log('🎯 Found the $5,982.67 payment from screenshot:');
        console.log(`   Date: ${suspectPayment.date.toLocaleDateString()}`);
        console.log(`   Debtor: ${suspectPayment.debt.debtorName}`);
        console.log(`   Type: ${suspectPayment.debt.type}`);
        console.log(`   Amount: $${suspectPayment.amount}`);
        console.log(`   Currency: ${suspectPayment.debt.currency}`);
        if (suspectPayment.debt.type === 'I_OWE') {
            console.log(`   ⚠️  This is I_OWE - was incorrectly shown as income!`);
            console.log(`   ✅ After fix, this will NOT appear in email report`);
        }
    } else {
        console.log('⚠️  Could not find the $5,982.67 payment - might be in different currency or rounded');
    }

    await prisma.$disconnect();
}

findAllDebtPayments().catch(console.error);
