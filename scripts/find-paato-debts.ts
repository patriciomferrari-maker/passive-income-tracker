import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findPaatoUser() {
    console.log('🔍 Finding Paato user and debt payments\n');

    // Find Paato's user
    const paato = await prisma.user.findUnique({
        where: { email: 'paato.ferrari@hotmail.com' },
        select: { id: true, name: true, email: true }
    });

    if (!paato) {
        console.error('❌ Paato user not found!');
        return;
    }

    console.log('✅ Found user:');
    console.log(`   ID: ${paato.id}`);
    console.log(`   Name: ${paato.name}`);
    console.log(`   Email: ${paato.email}\n`);

    // Get all debts
    const debts = await prisma.debt.findMany({
        where: { userId: paato.id },
        include: { payments: true }
    });

    console.log(`Total debts: ${debts.length}\n`);

    // Show I_OWE debts
    const iOweDebts = debts.filter(d => d.type === 'I_OWE');
    console.log('💸 I_OWE Debts (Money you owe):');
    iOweDebts.forEach(d => {
        const totalPaid = d.payments.reduce((acc, p) => acc + p.amount, 0);
        const balance = d.initialAmount - totalPaid;
        console.log(`   ${d.debtorName}: Initial $${d.initialAmount}, Paid $${totalPaid}, Balance $${balance}`);
        console.log(`   Payments: ${d.payments.length}`);
        d.payments.forEach(p => {
            console.log(`      - ${p.date.toLocaleDateString()}: $${p.amount}`);
        });
    });

    // Get all debt payments
    const allPayments = await prisma.debtPayment.findMany({
        where: { debt: { userId: paato.id } },
        include: { debt: true },
        orderBy: { date: 'desc' }
    });

    console.log(`\n📊 Total debt payments: ${allPayments.length}`);

    const iOwePayments = allPayments.filter(p => p.debt.type === 'I_OWE');
    const owedToMePayments = allPayments.filter(p => p.debt.type === 'OWED_TO_ME');

    console.log(`   I_OWE payments: ${iOwePayments.length} (total: $${iOwePayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2)})`);
    console.log(`   OWED_TO_ME payments: ${owedToMePayments.length} (total: $${owedToMePayments.reduce((acc, p) => acc + p.amount, 0).toFixed(2)})`);

    // Look for the $5,982.67 payment
    const suspectPayment = allPayments.find(p => Math.abs(p.amount - 5982.67) < 0.01);
    if (suspectPayment) {
        console.log('\n🎯 Found the $5,982.67 payment:');
        console.log(`   Date: ${suspectPayment.date.toLocaleDateString()}`);
        console.log(`   Debtor: ${suspectPayment.debt.debtorName}`);
        console.log(`   Type: ${suspectPayment.debt.type}`);
        console.log(`   Amount: $${suspectPayment.amount}`);
        if (suspectPayment.debt.type === 'I_OWE') {
            console.log(`   ⚠️  This is I_OWE - was incorrectly shown as income!`);
            console.log(`   ✅ After fix, this will NOT appear in email report`);
        }
    }

    await prisma.$disconnect();
}

findPaatoUser().catch(console.error);
