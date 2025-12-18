
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting full backup...');

    const data: any = {};

    // 1. Users
    data.users = await prisma.user.findMany();

    // 2. Properties & Contracts (Rentals)
    data.properties = await prisma.property.findMany();
    data.contracts = await prisma.contract.findMany();
    data.rentalCashflows = await prisma.rentalCashflow.findMany();

    // 3. Investments (ONs, Treasury)
    data.investments = await prisma.investment.findMany();
    data.transactions = await prisma.transaction.findMany();
    data.cashflows = await prisma.cashflow.findMany(); // Projected
    data.assetPrices = await prisma.assetPrice.findMany();
    data.amortizationSchedules = await prisma.amortizationSchedule.findMany();

    // 4. Debts
    data.debts = await prisma.debt.findMany();
    data.debtPayments = await prisma.debtPayment.findMany();

    // 5. Bank
    data.bankOperations = await prisma.bankOperation.findMany();

    // 6. Settings
    data.appSettings = await prisma.appSettings.findMany();

    // 7. Barbosa & Costa
    data.barbosaCategories = await prisma.barbosaCategory.findMany();
    data.barbosaSubCategories = await prisma.barbosaSubCategory.findMany();
    data.barbosaTransactions = await prisma.barbosaTransaction.findMany();
    data.barbosaRecurrences = await prisma.barbosaRecurrence.findMany();
    data.barbosaCleaning = await prisma.barbosaCleaning.findMany();

    data.costaCategories = await prisma.costaCategory.findMany();
    data.costaTransactions = await prisma.costaTransaction.findMany();
    data.costaNotes = await prisma.costaNote.findMany();

    // 8. Shared
    data.economicIndicators = await prisma.economicIndicator.findMany();
    data.inflationData = await prisma.inflationData.findMany();
    data.monthlySummaries = await prisma.monthlySummary.findMany();
    data.accessLogs = await prisma.accessLog.findMany();

    console.log('Backup statistics:');
    Object.keys(data).forEach(key => {
        console.log(`- ${key}: ${data[key].length} records`);
    });

    fs.writeFileSync('backup-full.json', JSON.stringify(data, null, 2));
    console.log('Backup saved to backup-full.json');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
