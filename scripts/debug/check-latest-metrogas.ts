import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLatestMetrogasCheck() {
    console.log('🔍 Checking latest Metrogas checks...\n');

    const checks = await prisma.utilityCheck.findMany({
        where: {
            serviceType: 'GAS',
            property: {
                name: 'Soldado'
            }
        },
        include: {
            property: {
                select: {
                    name: true,
                    gasId: true
                }
            }
        },
        orderBy: {
            checkDate: 'desc'
        },
        take: 5
    });

    console.log(`Found ${checks.length} recent checks:\n`);

    for (const check of checks) {
        const date = new Date(check.checkDate);
        const now = new Date();
        const hoursAgo = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

        console.log(`${check.status} - ${date.toLocaleString('es-AR')}`);
        console.log(`   (${hoursAgo} hours ago)`);
        console.log(`   Debt: $${check.debtAmount || 0}`);
        console.log(`   Auto: ${check.isAutomatic}`);
        if (check.errorMessage) {
            console.log(`   Error: ${check.errorMessage}`);
        }
        console.log('');
    }

    await prisma.$disconnect();
}

checkLatestMetrogasCheck()
    .catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
