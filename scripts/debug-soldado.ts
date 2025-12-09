
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Inspecting Soldado contracts...');

    // Find contracts with property name containing "Soldado"
    const contracts = await prisma.contract.findMany({
        where: {
            property: {
                name: { contains: 'Soldado', mode: 'insensitive' }
            }
        },
        include: {
            property: true
        }
    });

    console.log(`Found ${contracts.length} contracts for Soldado.`);

    for (const c of contracts) {
        console.log(`\nContract ID: ${c.id}`);
        console.log(`Property: ${c.property.name}`);
        console.log(`Tenant: ${c.tenantName}`);
        console.log(`Start Date: ${c.startDate}`);
        console.log(`Duration: ${c.durationMonths}`);
        console.log(`Cashflows (Oct/Nov equivalents):`);

        const cashflows = await prisma.rentalCashflow.findMany({
            where: {
                contractId: c.id,
                monthIndex: { in: [10, 11] }
            },
            orderBy: { monthIndex: 'asc' }
        });

        for (const cf of cashflows) {
            console.log(`  Month ${cf.monthIndex} (${cf.date.toISOString()}):`);
            console.log(`    Amount USD: ${cf.amountUSD}`);
            console.log(`    Amount ARS: ${cf.amountARS}`);
            console.log(`    TC: ${cf.tc}`);
            console.log(`    Inflation Accum: ${cf.inflationAccum}`);
            console.log(`    Devaluation Accum: ${cf.devaluationAccum}`);
        }
    }
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
