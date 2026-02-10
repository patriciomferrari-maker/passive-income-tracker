import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Estado actual de checks por servicio:\n');

    const serviceTypes = ['GAS', 'ELECTRICITY', 'AYSA', 'ABL', 'MUNICIPAL_GARAGE'];

    for (const serviceType of serviceTypes) {
        console.log(`\n━━━ ${serviceType} ━━━`);

        // Get last 3 checks for this service type
        const checks = await prisma.utilityCheck.findMany({
            where: { serviceType },
            orderBy: { checkDate: 'desc' },
            take: 3,
            include: {
                property: {
                    select: { name: true }
                }
            }
        });

        if (checks.length === 0) {
            console.log('   Sin checks registrados');
            continue;
        }

        checks.forEach((check, i) => {
            const icon = check.status === 'ERROR' ? '❌' : check.status === 'UP_TO_DATE' ? '✅' : '⚠️';
            const auto = check.isAutomatic ? '🤖 Auto' : '👤 Manual';
            const date = new Date(check.checkDate);
            const relativeTime = getRelativeTime(date);

            console.log(`\n${i === 0 ? '📌 ÚLTIMO' : `  ${i + 1}.`} ${icon} ${check.property.name}`);
            console.log(`   Estado: ${check.status}`);
            console.log(`   Origen: ${auto}`);
            console.log(`   Cuándo: ${date.toLocaleString('es-AR')} (${relativeTime})`);
            if (check.debtAmount) {
                console.log(`   Deuda: $${check.debtAmount.toLocaleString('es-AR')}`);
            }
            if (check.errorMessage) {
                console.log(`   🔴 Error: ${check.errorMessage.substring(0, 120)}`);
            }
        });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours}h`;
    return `hace ${diffDays} días`;
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
