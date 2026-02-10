import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🧹 Limpieza de Utility Checks antiguos\n');

    // Strategy: Keep only the latest check per property + service type
    // Delete all older checks

    const serviceTypes = ['GAS', 'ELECTRICITY', 'AYSA', 'ABL', 'MUNICIPAL_GARAGE'];

    let totalDeleted = 0;

    for (const serviceType of serviceTypes) {
        console.log(`\n📋 Procesando ${serviceType}...`);

        // Get all properties that have checks for this service type
        const propertiesWithChecks = await prisma.utilityCheck.findMany({
            where: { serviceType },
            select: { propertyId: true },
            distinct: ['propertyId']
        });

        console.log(`   Propiedades con checks: ${propertiesWithChecks.length}`);

        for (const { propertyId } of propertiesWithChecks) {
            // Get all checks for this property + service, ordered by date
            const checks = await prisma.utilityCheck.findMany({
                where: {
                    propertyId,
                    serviceType
                },
                orderBy: { checkDate: 'desc' }
            });

            if (checks.length <= 1) {
                // Only one check, keep it
                continue;
            }

            // Keep the first (most recent), delete the rest
            const toKeep = checks[0];
            const toDelete = checks.slice(1);

            console.log(`   Propiedad ${propertyId}: Manteniendo 1, eliminando ${toDelete.length}`);

            // Delete old checks
            const deleteResult = await prisma.utilityCheck.deleteMany({
                where: {
                    id: {
                        in: toDelete.map(c => c.id)
                    }
                }
            });

            totalDeleted += deleteResult.count;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Limpieza completada`);
    console.log(`🗑️  Total eliminados: ${totalDeleted} checks`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show what's left
    console.log('📊 Checks restantes:\n');

    for (const serviceType of serviceTypes) {
        const remaining = await prisma.utilityCheck.count({
            where: { serviceType }
        });

        if (remaining > 0) {
            const latest = await prisma.utilityCheck.findFirst({
                where: { serviceType },
                orderBy: { checkDate: 'desc' },
                include: {
                    property: { select: { name: true } }
                }
            });

            if (latest) {
                const icon = latest.status === 'ERROR' ? '❌' : latest.status === 'UP_TO_DATE' ? '✅' : '⚠️';
                const date = new Date(latest.checkDate).toLocaleString('es-AR');
                console.log(`${icon} ${serviceType}: ${latest.status} (${date})`);
            }
        }
    }

    console.log('\n---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
