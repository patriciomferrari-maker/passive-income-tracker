
import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting data restoration...');

    // Read backup file
    const rawData = fs.readFileSync('backup-full.json', 'utf-8');
    const data = JSON.parse(rawData);

    // Order of restoration is critical due to foreign keys
    // 1. Users
    if (data.users?.length) {
        console.log(`Restoring ${data.users.length} Users...`);
        for (const user of data.users) {
            await prisma.user.upsert({
                where: { id: user.id },
                update: {},
                create: { ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) }
            });
        }
    }

    // 2. Settings (Depends on User)
    if (data.appSettings?.length) {
        console.log(`Restoring Settings...`);
        for (const s of data.appSettings) {
            await prisma.appSettings.upsert({
                where: { id: s.id },
                update: {},
                create: { ...s, createdAt: new Date(s.createdAt), updatedAt: new Date(s.updatedAt) }
            });
        }
    }

    // 3. Properties (Rentals)
    if (data.properties?.length) {
        console.log(`Restoring Properties...`);
        for (const p of data.properties) {
            await prisma.property.create({
                data: { ...p, createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) }
            });
        }
    }

    // 4. Contracts (Depends on Property)
    if (data.contracts?.length) {
        console.log(`Restoring Contracts...`);
        for (const c of data.contracts) {
            await prisma.contract.create({
                data: {
                    ...c,
                    startDate: new Date(c.startDate),
                    createdAt: new Date(c.createdAt),
                    updatedAt: new Date(c.updatedAt)
                }
            });
        }
    }

    // 5. Rental Cashflows (Depends on Contract)
    if (data.rentalCashflows?.length) {
        console.log(`Restoring Rental Cashflows...`);
        for (const rc of data.rentalCashflows) {
            await prisma.rentalCashflow.create({
                data: {
                    ...rc,
                    date: new Date(rc.date),
                    createdAt: new Date(rc.createdAt)
                }
            });
        }
    }

    // 6. Investments
    if (data.investments?.length) {
        console.log(`Restoring Investments...`);
        for (const inv of data.investments) {
            await prisma.investment.create({
                data: {
                    ...inv,
                    emissionDate: inv.emissionDate ? new Date(inv.emissionDate) : null,
                    maturityDate: inv.maturityDate ? new Date(inv.maturityDate) : null,
                    lastPriceDate: inv.lastPriceDate ? new Date(inv.lastPriceDate) : null,
                    createdAt: new Date(inv.createdAt),
                    updatedAt: new Date(inv.updatedAt)
                }
            });
        }
    }

    // 7. Transactions (Depends on Investment)
    if (data.transactions?.length) {
        console.log(`Restoring Transactions...`);
        for (const tx of data.transactions) {
            await prisma.transaction.create({
                data: {
                    ...tx,
                    date: new Date(tx.date),
                    createdAt: new Date(tx.createdAt),
                    updatedAt: new Date(tx.updatedAt)
                }
            });
        }
    }

    // 8. Asset Prices (Depends on Investment)
    if (data.assetPrices?.length) {
        console.log(`Restoring Asset Prices...`);
        // Batch creation might be better but loop is safer for simple scripts
        for (const ap of data.assetPrices) {
            await prisma.assetPrice.create({
                data: {
                    ...ap,
                    date: new Date(ap.date),
                    createdAt: new Date(ap.createdAt)
                }
            });
        }
    }

    // 9. Amortization Schedules
    if (data.amortizationSchedules?.length) {
        console.log(`Restoring Amortization Schedules...`);
        for (const as of data.amortizationSchedules) {
            await prisma.amortizationSchedule.create({
                data: {
                    ...as,
                    paymentDate: new Date(as.paymentDate),
                    createdAt: new Date(as.createdAt),
                    updatedAt: new Date(as.updatedAt)
                }
            });
        }
    }

    // 10. Cashflow (Projected - Depends on Investment)
    if (data.cashflows?.length) {
        console.log(`Restoring Investment Cashflows...`);
        for (const cf of data.cashflows) {
            await prisma.cashflow.create({
                data: {
                    ...cf,
                    date: new Date(cf.date),
                    createdAt: new Date(cf.createdAt),
                    updatedAt: new Date(cf.updatedAt)
                }
            });
        }
    }

    // 11. Debts
    if (data.debts?.length) {
        console.log(`Restoring Debts...`);
        for (const d of data.debts) {
            await prisma.debt.create({
                data: {
                    ...d,
                    startDate: new Date(d.startDate),
                    createdAt: new Date(d.createdAt),
                    updatedAt: new Date(d.updatedAt)
                }
            });
        }
    }

    // 12. Debt Payments
    if (data.debtPayments?.length) {
        console.log(`Restoring Debt Payments...`);
        for (const dp of data.debtPayments) {
            await prisma.debtPayment.create({
                data: {
                    ...dp,
                    date: new Date(dp.date),
                    createdAt: new Date(dp.createdAt),
                    updatedAt: new Date(dp.updatedAt)
                }
            });
        }
    }

    // 13. Bank Operations
    if (data.bankOperations?.length) {
        console.log(`Restoring Bank Operations...`);
        for (const bo of data.bankOperations) {
            await prisma.bankOperation.create({
                data: {
                    ...bo,
                    startDate: bo.startDate ? new Date(bo.startDate) : null,
                    createdAt: new Date(bo.createdAt),
                    updatedAt: new Date(bo.updatedAt)
                }
            });
        }
    }

    // 14. Barbosa Categories
    if (data.barbosaCategories?.length) {
        console.log(`Restoring Barbosa Categories...`);
        for (const cat of data.barbosaCategories) {
            await prisma.barbosaCategory.create({
                data: { ...cat, createdAt: new Date(cat.createdAt), updatedAt: new Date(cat.updatedAt) }
            });
        }
    }

    // 15. Barbosa SubCategories
    if (data.barbosaSubCategories?.length) {
        console.log(`Restoring Barbosa Sub-Categories...`);
        for (const sub of data.barbosaSubCategories) {
            await prisma.barbosaSubCategory.create({
                data: { ...sub, createdAt: new Date(sub.createdAt), updatedAt: new Date(sub.updatedAt) }
            });
        }
    }

    // 16. Barbosa Transactions
    if (data.barbosaTransactions?.length) {
        console.log(`Restoring Barbosa Transactions...`);
        for (const tx of data.barbosaTransactions) {
            await prisma.barbosaTransaction.create({
                data: {
                    ...tx,
                    date: new Date(tx.date),
                    createdAt: new Date(tx.createdAt),
                    updatedAt: new Date(tx.updatedAt)
                }
            });
        }
    }

    // 17. Barbosa Recurrences
    if (data.barbosaRecurrences?.length) {
        console.log(`Restoring Barbosa Recurrences...`);
        for (const br of data.barbosaRecurrences) {
            await prisma.barbosaRecurrence.create({
                data: { ...br, createdAt: new Date(br.createdAt), updatedAt: new Date(br.updatedAt) }
            });
        }
    }

    // 18. Barbosa Cleaning
    if (data.barbosaCleaning?.length) {
        console.log(`Restoring Barbosa Cleaning...`);
        for (const bc of data.barbosaCleaning) {
            await prisma.barbosaCleaning.create({
                data: { ...bc, createdAt: new Date(bc.createdAt), updatedAt: new Date(bc.updatedAt) }
            });
        }
    }

    // 19. Costa Categories
    if (data.costaCategories?.length) {
        console.log(`Restoring Costa Categories...`);
        for (const cat of data.costaCategories) {
            await prisma.costaCategory.create({
                data: { ...cat, createdAt: new Date(cat.createdAt), updatedAt: new Date(cat.updatedAt) }
            });
        }
    }

    // 20. Costa Transactions
    if (data.costaTransactions?.length) {
        console.log(`Restoring Costa Transactions...`);
        for (const tx of data.costaTransactions) {
            await prisma.costaTransaction.create({
                data: {
                    ...tx,
                    date: new Date(tx.date),
                    rentalCheckOut: tx.rentalCheckOut ? new Date(tx.rentalCheckOut) : null,
                    createdAt: new Date(tx.createdAt),
                    updatedAt: new Date(tx.updatedAt)
                }
            });
        }
    }

    // 21. Costa Notes
    if (data.costaNotes?.length) {
        console.log(`Restoring Costa Notes...`);
        for (const cn of data.costaNotes) {
            await prisma.costaNote.create({
                data: { ...cn, createdAt: new Date(cn.createdAt), updatedAt: new Date(cn.updatedAt) }
            });
        }
    }

    // 22. Economic Indicators
    if (data.economicIndicators?.length) {
        console.log(`Restoring Economic Indicators...`);
        for (const ei of data.economicIndicators) {
            await prisma.economicIndicator.upsert({
                where: { id: ei.id },
                update: {},
                create: {
                    ...ei,
                    date: new Date(ei.date),
                    createdAt: new Date(ei.createdAt),
                    updatedAt: new Date(ei.updatedAt)
                }
            });
        }
    }

    // 23. Inflation Data
    if (data.inflationData?.length) {
        console.log(`Restoring Inflation Data...`);
        for (const inf of data.inflationData) {
            await prisma.inflationData.upsert({
                where: { id: inf.id },
                update: {},
                create: {
                    ...inf,
                    updatedAt: new Date(inf.updatedAt)
                }
            });
        }
    }

    // 24. Monthly Summaries
    if (data.monthlySummaries?.length) {
        console.log(`Restoring Monthly Summaries...`);
        for (const ms of data.monthlySummaries) {
            await prisma.monthlySummary.upsert({
                where: { id: ms.id },
                update: {},
                create: {
                    ...ms,
                    createdAt: new Date(ms.createdAt),
                    updatedAt: new Date(ms.updatedAt)
                }
            });
        }
    }

    console.log('Restoration completed successfully!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
