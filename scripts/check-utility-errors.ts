import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📋 Estado de verificaciones de servicios:\n');

    const checks = await prisma.utilityCheck.findMany({
        orderBy: { checkDate: 'desc' },
        take: 20,
        include: {
            property: {
                select: { name: true }
            }
        }
    });

    checks.forEach(check => {
        const icon = check.status === 'ERROR' ? '❌' : check.status === 'UP_TO_DATE' ? '✅' : '⚠️';
        const date = new Date(check.checkDate).toLocaleString('es-AR');

        console.log(`${icon} ${check.property.name} - ${check.serviceType}`);
        console.log(`   Estado: ${check.status}`);
        console.log(`   Fecha: ${date}`);
        console.log(`   Cuenta: ${check.accountNumber}`);
        if (check.errorMessage) {
            console.log(`   ❗ Error: ${check.errorMessage}`);
        }
        if (check.debtAmount) {
            console.log(`   💰 Deuda: $${check.debtAmount}`);
        }
        console.log('');
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
