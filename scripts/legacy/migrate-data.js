
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
        db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function migrate() {
    try {
        console.log('Starting migration...');

        // 1. Economic Indicators (Independent)
        const indicators = await getRows('EconomicIndicator');
        console.log(`Migrating ${indicators.length} EconomicIndicators...`);
        for (const row of indicators) {
            await prisma.economicIndicator.upsert({
                where: { type_date: { type: row.type, date: new Date(row.date) } },
                update: {},
                create: {
                    id: row.id,
                    type: row.type,
                    date: new Date(row.date),
                    value: row.value,
                    buyRate: row.buyRate,
                    sellRate: row.sellRate,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 2. Properties (Parent of Contracts)
        const properties = await getRows('Property');
        console.log(`Migrating ${properties.length} Properties...`);
        for (const row of properties) {
            await prisma.property.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    name: row.name,
                    address: row.address,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 3. Contracts (Depends on Property)
        const contracts = await getRows('Contract');
        console.log(`Migrating ${contracts.length} Contracts...`);
        for (const row of contracts) {
            await prisma.contract.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 4. RentalCashflow (Depends on Contract)
        const rentalCashflows = await getRows('RentalCashflow');
        console.log(`Migrating ${rentalCashflows.length} RentalCashflows...`);
        for (const row of rentalCashflows) {
            await prisma.rentalCashflow.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 5. Investments (ON/Treasury)
        const investments = await getRows('Investment');
        console.log(`Migrating ${investments.length} Investments...`);
        for (const row of investments) {
            await prisma.investment.upsert({
                where: { ticker: row.ticker }, // Using ticker as unique constraint might be better than ID if IDs changed, but let's try ID first. Wait, schema says ticker is @unique.
                update: {},
                create: {
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
                }
            });
        }

        // 6. AmortizationSchedule (Depends on Investment)
        const schedules = await getRows('AmortizationSchedule');
        console.log(`Migrating ${schedules.length} AmortizationSchedules...`);
        for (const row of schedules) {
            await prisma.amortizationSchedule.upsert({
                where: { investmentId_paymentDate: { investmentId: row.investmentId, paymentDate: new Date(row.paymentDate) } },
                update: {},
                create: {
                    id: row.id,
                    investmentId: row.investmentId,
                    paymentDate: new Date(row.paymentDate),
                    percentage: row.percentage,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 7. Transactions (Depends on Investment)
        const transactions = await getRows('Transaction');
        console.log(`Migrating ${transactions.length} Transactions...`);
        for (const row of transactions) {
            await prisma.transaction.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 8. Cashflow (Depends on Investment - these are projected flows)
        const cashflows = await getRows('Cashflow');
        console.log(`Migrating ${cashflows.length} Cashflows...`);
        for (const row of cashflows) {
            await prisma.cashflow.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 9. Debts (Independent)
        const debts = await getRows('Debt');
        console.log(`Migrating ${debts.length} Debts...`);
        for (const row of debts) {
            await prisma.debt.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    debtorName: row.debtorName,
                    startDate: new Date(row.startDate),
                    initialAmount: row.initialAmount,
                    currency: row.currency,
                    status: row.status,
                    details: row.details,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 10. DebtPayment (Depends on Debt)
        const debtPayments = await getRows('DebtPayment');
        console.log(`Migrating ${debtPayments.length} DebtPayments...`);
        for (const row of debtPayments) {
            await prisma.debtPayment.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    debtId: row.debtId,
                    date: new Date(row.date),
                    amount: row.amount,
                    type: row.type,
                    description: row.description,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 11. BankOperation (Independent)
        const bankOps = await getRows('BankOperation');
        console.log(`Migrating ${bankOps.length} BankOperations...`);
        for (const row of bankOps) {
            await prisma.bankOperation.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 12. CostaCategory (Parent)
        const costaCats = await getRows('CostaCategory');
        console.log(`Migrating ${costaCats.length} CostaCategories...`);
        for (const row of costaCats) {
            await prisma.costaCategory.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    name: row.name,
                    type: row.type,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        // 13. CostaTransaction (Depends on CostaCategory)
        const costaTxs = await getRows('CostaTransaction');
        console.log(`Migrating ${costaTxs.length} CostaTransactions...`);
        for (const row of costaTxs) {
            await prisma.costaTransaction.upsert({
                where: { id: row.id },
                update: {},
                create: {
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
                }
            });
        }

        // 14. CostaNotes (Independent)
        const costaNotes = await getRows('CostaNote');
        console.log(`Migrating ${costaNotes.length} CostaNotes...`);
        for (const row of costaNotes) {
            await prisma.costaNote.upsert({
                where: { id: row.id },
                update: {},
                create: {
                    id: row.id,
                    content: row.content,
                    category: row.category,
                    status: row.status,
                    createdAt: new Date(row.createdAt),
                    updatedAt: new Date(row.updatedAt)
                }
            });
        }

        console.log('Migration Completed Successfully!');

    } catch (error) {
        console.error('Migration Failed:', error);
    } finally {
        await prisma.$disconnect();
        db.close();
    }
}

migrate();
