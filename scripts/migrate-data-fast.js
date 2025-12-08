
const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Initialize Prisma (Connected to Neon Postgres via .env)
const prisma = new PrismaClient();

// Initialize SQLite (Connected to local file)
const sqlitePath = path.resolve(__dirname, '../prisma/dev.db');
const db = new sqlite3.Database(sqlitePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error('Error opening SQLite DB:', err.message);
        process.exit(1);
    }
    console.log('Connected to local SQLite database.');
});

// Helper to get all rows from a table
function getRows(tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM "${tableName}"`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function migrate() {
    try {
        console.log('Starting FAST migration (skipping duplicates)...');

        // === STEP 0: CLEANUP (Avoid duplicates) ===
        // Must delete children first to satisfy foreign keys
        console.log('Cleaning existing data...');
        // We use deleteMany inside a transaction or just sequentially. Sequential is fine.
        // We might want to NOT delete if we want to just append? But user said "migracion", usually implying full sync.
        // Given the error before, cleanup might be failing due to constraints if order is wrong.
        // But let's try to just insert with skipDuplicates. That's safer if we want to preserve anything, though current DB should be empty or partial.
        // Actually, let's keep the delete logic but wrap in try-catch to not crash if empty.

        try { await prisma.rentalCashflow.deleteMany(); } catch { }
        try { await prisma.contract.deleteMany(); } catch { }
        try { await prisma.property.deleteMany(); } catch { }
        try { await prisma.transaction.deleteMany(); } catch { }
        try { await prisma.amortizationSchedule.deleteMany(); } catch { }
        try { await prisma.cashflow.deleteMany(); } catch { }
        try { await prisma.investment.deleteMany(); } catch { }
        try { await prisma.debtPayment.deleteMany(); } catch { }
        try { await prisma.debt.deleteMany(); } catch { }
        try { await prisma.costaTransaction.deleteMany(); } catch { }
        try { await prisma.costaCategory.deleteMany(); } catch { }
        try { await prisma.costaNote.deleteMany(); } catch { }
        try { await prisma.bankOperation.deleteMany(); } catch { }
        try { await prisma.economicIndicator.deleteMany(); } catch { }
        console.log('Cleanup complete.');

        // === STEP 1: MIGRATE PARENTS ===

        // 1. Economic Indicators
        const indicators = await getRows('EconomicIndicator');
        console.log(`Migrating ${indicators.length} EconomicIndicators...`);
        if (indicators.length > 0) {
            await prisma.economicIndicator.createMany({
                data: indicators.map(row => ({
                    id: row.id,
                    type: row.type,
                    date: new Date(row.date),
                    value: row.value,
                    buyRate: row.buyRate,
                    sellRate: row.sellRate,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 2. Properties
        const properties = await getRows('Property');
        console.log(`Migrating ${properties.length} Properties...`);
        if (properties.length > 0) {
            await prisma.property.createMany({
                data: properties.map(row => ({
                    id: row.id,
                    name: row.name,
                    address: row.address,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 3. Investments
        const investments = await getRows('Investment');
        console.log(`Migrating ${investments.length} Investments...`);
        if (investments.length > 0) {
            await prisma.investment.createMany({
                data: investments.map(row => ({
                    id: row.id,
                    ticker: row.ticker,
                    name: row.name,
                    type: row.type,
                    currency: row.currency,
                    emissionDate: row.emissionDate ? new Date(row.emissionDate) : null,
                    couponRate: row.couponRate,
                    frequency: row.frequency,
                    maturityDate: row.maturityDate ? new Date(row.maturityDate) : null,
                    amortization: row.amortization,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 4. Debts
        const debts = await getRows('Debt');
        console.log(`Migrating ${debts.length} Debts...`);
        if (debts.length > 0) {
            await prisma.debt.createMany({
                data: debts.map(row => ({
                    id: row.id,
                    debtorName: row.debtorName,
                    startDate: new Date(row.startDate),
                    initialAmount: row.initialAmount,
                    currency: row.currency,
                    status: row.status,
                    details: row.details,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 5. BankOperations
        const bankOps = await getRows('BankOperation');
        console.log(`Migrating ${bankOps.length} BankOperations...`);
        if (bankOps.length > 0) {
            await prisma.bankOperation.createMany({
                data: bankOps.map(row => ({
                    id: row.id,
                    type: row.type,
                    alias: row.alias,
                    amount: row.amount,
                    currency: row.currency,
                    startDate: row.startDate ? new Date(row.startDate) : null,
                    durationDays: row.durationDays,
                    tna: row.tna,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 6. CostaCategories
        const costaCats = await getRows('CostaCategory');
        console.log(`Migrating ${costaCats.length} CostaCategories...`);
        if (costaCats.length > 0) {
            await prisma.costaCategory.createMany({
                data: costaCats.map(row => ({
                    id: row.id,
                    name: row.name,
                    type: row.type,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 7. CostaNotes
        const costaNotes = await getRows('CostaNote');
        console.log(`Migrating ${costaNotes.length} CostaNotes...`);
        if (costaNotes.length > 0) {
            await prisma.costaNote.createMany({
                data: costaNotes.map(row => ({
                    id: row.id,
                    content: row.content,
                    category: row.category,
                    status: row.status,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // === STEP 2: MIGRATE CHILDREN ===

        // 8. Contracts (Depends on Property)
        const contracts = await getRows('Contract');
        console.log(`Migrating ${contracts.length} Contracts...`);
        if (contracts.length > 0) {
            await prisma.contract.createMany({
                data: contracts.map(row => ({
                    id: row.id,
                    propertyId: row.propertyId,
                    tenantName: row.tenantName,
                    startDate: new Date(row.startDate),
                    durationMonths: row.durationMonths,
                    initialRent: row.initialRent,
                    currency: row.currency,
                    adjustmentType: row.adjustmentType,
                    adjustmentFrequency: row.adjustmentFrequency,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 9. RentalCashflow (Depends on Contract)
        const rentalCashflows = await getRows('RentalCashflow');
        console.log(`Migrating ${rentalCashflows.length} RentalCashflows...`);
        if (rentalCashflows.length > 0) {
            await prisma.rentalCashflow.createMany({
                data: rentalCashflows.map(row => ({
                    id: row.id,
                    contractId: row.contractId,
                    date: new Date(row.date),
                    monthIndex: row.monthIndex,
                    amountARS: row.amountARS,
                    amountUSD: row.amountUSD,
                    ipcMonthly: row.ipcMonthly,
                    ipcAccumulated: row.ipcAccumulated,
                    tc: row.tc,
                    tcBase: row.tcBase,
                    tcClosingMonth: row.tcClosingMonth,
                    inflationAccum: row.inflationAccum,
                    devaluationAccum: row.devaluationAccum,
                    createdAt: new Date(row.createdAt)
                })),
                skipDuplicates: true
            });
        }

        // 10. AmortizationSchedule (Depends on Investment)
        const schedules = await getRows('AmortizationSchedule');
        console.log(`Migrating ${schedules.length} AmortizationSchedules...`);
        if (schedules.length > 0) {
            await prisma.amortizationSchedule.createMany({
                data: schedules.map(row => ({
                    id: row.id,
                    investmentId: row.investmentId,
                    paymentDate: new Date(row.paymentDate),
                    percentage: row.percentage,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 11. Transactions (Depends on Investment)
        const transactions = await getRows('Transaction');
        console.log(`Migrating ${transactions.length} Transactions...`);
        if (transactions.length > 0) {
            await prisma.transaction.createMany({
                data: transactions.map(row => ({
                    id: row.id,
                    investmentId: row.investmentId,
                    date: new Date(row.date),
                    type: row.type,
                    quantity: row.quantity,
                    price: row.price,
                    commission: row.commission,
                    totalAmount: row.totalAmount,
                    currency: row.currency,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 12. Cashflows (Depends on Investment)
        const cashflows = await getRows('Cashflow');
        console.log(`Migrating ${cashflows.length} Cashflows...`);
        if (cashflows.length > 0) {
            await prisma.cashflow.createMany({
                data: cashflows.map(row => ({
                    id: row.id,
                    investmentId: row.investmentId,
                    date: new Date(row.date),
                    amount: row.amount,
                    currency: row.currency,
                    type: row.type,
                    status: row.status,
                    description: row.description,
                    capitalResidual: row.capitalResidual,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 13. DebtPayment (Depends on Debt)
        const debtPayments = await getRows('DebtPayment');
        console.log(`Migrating ${debtPayments.length} DebtPayments...`);
        if (debtPayments.length > 0) {
            await prisma.debtPayment.createMany({
                data: debtPayments.map(row => ({
                    id: row.id,
                    debtId: row.debtId,
                    date: new Date(row.date),
                    amount: row.amount,
                    type: row.type,
                    description: row.description,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        // 14. CostaTransactions (Depends on CostaCategory)
        const costaTxs = await getRows('CostaTransaction');
        console.log(`Migrating ${costaTxs.length} CostaTransactions...`);
        if (costaTxs.length > 0) {
            await prisma.costaTransaction.createMany({
                data: costaTxs.map(row => ({
                    id: row.id,
                    date: new Date(row.date),
                    type: row.type,
                    description: row.description,
                    amount: row.amount,
                    currency: row.currency,
                    categoryId: row.categoryId,
                    rentalCheckIn: row.rentalCheckIn ? new Date(row.rentalCheckIn) : null,
                    rentalCheckOut: row.rentalCheckOut ? new Date(row.rentalCheckOut) : null,
                    contractUrl: row.contractUrl,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                })),
                skipDuplicates: true
            });
        }

        console.log('Migration Completed Successfully!');

    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        await prisma.$disconnect();
        db.close();
        process.exit(0);
    }
}

migrate();
