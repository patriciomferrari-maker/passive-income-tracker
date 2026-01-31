const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getLatestChecks() {
    try {
        const properties = await prisma.property.findMany({
            select: {
                id: true,
                name: true,
                gasId: true,
                electricityId: true,
                municipalId: true,
                aysaId: true,
                garageMunicipalId: true
            }
        });

        console.log('# DETALLE DE SERVICIOS POR PROPIEDAD\n');

        for (const property of properties) {
            console.log(`## 🏠 ${property.name}`);

            const checks = await prisma.utilityCheck.findMany({
                where: {
                    propertyId: property.id,
                    OR: [
                        { notes: null },
                        { notes: { not: 'LEGACY' } }
                    ]
                },
                orderBy: { createdAt: 'desc' },
                distinct: ['serviceType', 'accountNumber'],
            });

            if (checks.length === 0) {
                console.log('- Sin registros de servicios.\n');
                continue;
            }

            for (const check of checks) {
                const statusIcon = check.status === 'UP_TO_DATE' ? '✅' : check.status === 'OVERDUE' ? '⚠️' : '❌';
                const debt = check.debtAmount > 0 ? ` - Deuda: $${check.debtAmount.toLocaleString('es-AR')}` : '';
                const date = check.lastBillDate ? ` (F. Factura: ${new Date(check.lastBillDate).toLocaleDateString()})` : '';
                const error = check.errorMessage ? ` [Error: ${check.errorMessage}]` : '';

                console.log(`- ${statusIcon} **${check.serviceType}** (${check.accountNumber}): ${check.status}${debt}${date}${error}`);
            }
            console.log('\n');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

getLatestChecks();
