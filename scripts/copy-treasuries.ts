
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_USER_ID = 'cmixpqcnk00003mnmljva12cg'; // patricio (carlos)
const TARGET_USER_ID = 'cmkheox6o000010w6ubl2uf5c'; // test

async function main() {
    console.log(`Starting replication from ${SOURCE_USER_ID} to ${TARGET_USER_ID}...`);

    // 1. Fetch Source Investments
    const investments = await prisma.investment.findMany({
        where: {
            userId: SOURCE_USER_ID,
            OR: [
                { type: { in: ['TREASURY', 'ETF'] } },
                { market: 'US' }
            ]
        },
        include: {
            transactions: true,
            cashflows: true,
            amortizationSchedules: true,
            assetPrices: true,
        }
    });

    console.log(`Found ${investments.length} investments to replicate.`);

    for (const inv of investments) {
        console.log(`Processing ${inv.ticker}...`);

        // Check if exists for target
        const existing = await prisma.investment.findFirst({
            where: {
                userId: TARGET_USER_ID,
                ticker: inv.ticker
            }
        });

        if (existing) {
            console.log(`Skipping ${inv.ticker} - Already exists for target user.`);
            continue;
        }

        // Create Investment
        try {
            const newInv = await prisma.investment.create({
                data: {
                    userId: TARGET_USER_ID, // NEW USER
                    ticker: inv.ticker,
                    name: inv.name,
                    type: inv.type,
                    currency: inv.currency,
                    emissionDate: inv.emissionDate,
                    couponRate: inv.couponRate,
                    frequency: inv.frequency,
                    maturityDate: inv.maturityDate,
                    amortization: inv.amortization,
                    market: inv.market, // Ensure market is copied

                    // Copy relations
                    transactions: {
                        create: inv.transactions.map(t => ({
                            date: t.date,
                            type: t.type,
                            quantity: t.quantity,
                            price: t.price,
                            commission: t.commission,
                            totalAmount: t.totalAmount,
                            currency: t.currency,
                            notes: t.notes,
                            updatedAt: t.updatedAt,
                            createdAt: t.createdAt // Preserve dates if possible? Prisma might overwrite createAt, but okay.
                        }))
                    },
                    cashflows: {
                        create: inv.cashflows.map(c => ({
                            date: c.date,
                            amount: c.amount,
                            currency: c.currency,
                            type: c.type,
                            status: c.status,
                            description: c.description,
                            capitalResidual: c.capitalResidual,
                        }))
                    },
                    amortizationSchedules: {
                        create: inv.amortizationSchedules.map(a => ({
                            paymentDate: a.paymentDate,
                            percentage: a.percentage
                        }))
                    },
                    assetPrices: {
                        create: inv.assetPrices.map(p => ({
                            date: p.date,
                            price: p.price,
                            currency: p.currency
                        }))
                    }
                }
            });
            console.log(`Created ${newInv.ticker} for target user.`);
        } catch (error) {
            console.error(`Failed to copy ${inv.ticker}:`, error);
        }
    }

    console.log('Replication complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
