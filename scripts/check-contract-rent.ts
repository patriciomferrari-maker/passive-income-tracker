import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find N2 3D contract
    const contract = await prisma.contract.findFirst({
        where: {
            property: {
                name: 'N2 3D'
            }
        },
        include: {
            property: true,
            rentalCashflows: {
                orderBy: { date: 'desc' },
                take: 10
            }
        }
    });

    if (!contract) {
        console.log('❌ Contract not found');
        return;
    }

    console.log('\n📋 Contract Info:');
    console.log(`Property: ${contract.property.name}`);
    console.log(`Initial Rent: $${contract.initialRent.toLocaleString('es-AR')}`);
    console.log(`Start Date: ${new Date(contract.startDate).toLocaleDateString('es-AR')}`);
    console.log(`Adjustment Type: ${contract.adjustmentType}`);
    console.log(`Adjustment Frequency: ${contract.adjustmentFrequency} months`);

    console.log('\n💰 Recent Cashflows (last 10):');
    contract.rentalCashflows.forEach((cf, idx) => {
        console.log(`${idx + 1}. ${new Date(cf.date).toLocaleDateString('es-AR')}: $${cf.amountARS?.toLocaleString('es-AR') || 'N/A'}`);
    });

    const lastRent = contract.rentalCashflows[0]?.amountARS || contract.initialRent;
    console.log(`\n🎯 Current logic returns: $${lastRent.toLocaleString('es-AR')}`);
    console.log(`   (from ${contract.rentalCashflows[0] ? 'cashflow' : 'initialRent'})`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
