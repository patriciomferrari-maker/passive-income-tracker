import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Análisis de checks con ERROR:\n');

    // Get all ERROR checks
    const errorChecks = await prisma.utilityCheck.findMany({
        where: { status: 'ERROR' },
        orderBy: { checkDate: 'desc' },
        include: {
            property: {
                select: { name: true, jurisdiction: true }
            }
        },
        take: 20
    });

    console.log(`Total ERROR checks en DB: ${errorChecks.length}\n`);

    if (errorChecks.length > 0) {
        console.log('❌ Últimos 20 checks con ERROR:\n');
        errorChecks.forEach(check => {
            const date = new Date(check.checkDate).toLocaleString('es-AR');
            console.log(`${check.property.name} - ${check.serviceType}`);
            console.log(`   Fecha: ${date}`);
            console.log(`   Automático: ${check.isAutomatic ? 'Sí' : 'No'}`);
            if (check.errorMessage) {
                console.log(`   Error: ${check.errorMessage.substring(0, 150)}`);
            }
            console.log('');
        });
    }

    // Now check latest check per property/service
    console.log('\n📊 Último check de cada servicio (todos los estados):\n');

    const serviceTypes = ['GAS', 'ELECTRICITY', 'AYSA', 'ABL', 'MUNICIPAL_GARAGE'];

    for (const serviceType of serviceTypes) {
        const latestCheck = await prisma.utilityCheck.findFirst({
            where: { serviceType },
            orderBy: { checkDate: 'desc' },
            include: {
                property: { select: { name: true } }
            }
        });

        if (latestCheck) {
            const icon = latestCheck.status === 'ERROR' ? '❌' : latestCheck.status === 'UP_TO_DATE' ? '✅' : '⚠️';
            const date = new Date(latestCheck.checkDate).toLocaleString('es-AR');
            console.log(`${icon} ${serviceType} (${latestCheck.property.name})`);
            console.log(`   Estado: ${latestCheck.status}`);
            console.log(`   Fecha: ${date}`);
            console.log(`   Automático: ${latestCheck.isAutomatic ? 'Sí (Vercel cron)' : 'No (Manual/Local)'}`);
            if (latestCheck.errorMessage) {
                console.log(`   ❗ Error: ${latestCheck.errorMessage.substring(0, 100)}...`);
            }
            console.log('');
        }
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
