import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Buscando checks con estado ERROR:\n');

    const errorChecks = await prisma.utilityCheck.findMany({
        where: { status: 'ERROR' },
        orderBy: { checkDate: 'desc' },
        include: {
            property: {
                select: { name: true, jurisdiction: true }
            }
        }
    });

    console.log(`Total checks con ERROR: ${errorChecks.length}\n`);

    errorChecks.forEach(check => {
        const date = new Date(check.checkDate).toLocaleString('es-AR');

        console.log(`❌ ${check.property.name} (${check.property.jurisdiction})`);
        console.log(`   Servicio: ${check.serviceType}`);
        console.log(`   Fecha: ${date}`);
        console.log(`   Cuenta: ${check.accountNumber}`);
        if (check.errorMessage) {
            console.log(`   ❗ Error: ${check.errorMessage.substring(0, 200)}`);
        }
        console.log('');
    });

    // Ver cuál es el check MÁS RECIENTE por cada servicio
    console.log('\n📊 Último check de cada tipo de servicio:\n');

    const serviceTypes = ['GAS', 'ELECTRICITY', 'AYSA', 'ABL', 'MUNICIPAL_GARAGE'];

    for (const type of serviceTypes) {
        const latest = await prisma.utilityCheck.findFirst({
            where: { serviceType: type },
            orderBy: { checkDate: 'desc' },
            include: {
                property: { select: { name: true } }
            }
        });

        if (latest) {
            const icon = latest.status === 'ERROR' ? '❌' : latest.status === 'UP_TO_DATE' ? '✅' : '⚠️';
            const date = new Date(latest.checkDate).toLocaleString('es-AR');
            console.log(`${icon} ${type}: ${latest.status} (${date})`);
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
