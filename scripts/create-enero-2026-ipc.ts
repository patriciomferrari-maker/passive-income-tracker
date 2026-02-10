import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📅 Creando IPC de Enero 2026...\n');

    // Según INDEC, el IPC de enero 2026 fue 2.2%
    // Fuente: https://www.indec.gob.ar/
    const eneroIPCValue = 2.2;
    const eneroInterannual = 84.5; // Dato interanual de enero 2026

    // Fecha: último día de enero 2026
    const eneroDate = new Date(Date.UTC(2026, 0, 31, 12, 0, 0));

    console.log('Datos a cargar:');
    console.log(`📅 Fecha: ${eneroDate.toLocaleDateString('es-AR')}`);
    console.log(`📊 IPC Mensual: ${eneroIPCValue}%`);
    console.log(`📈 IPC Interanual: ${eneroInterannual}%\n`);

    try {
        const ipc = await prisma.economicIndicator.upsert({
            where: {
                type_date: {
                    type: 'IPC',
                    date: eneroDate
                }
            },
            update: {
                value: eneroIPCValue,
                interannualValue: eneroInterannual
            },
            create: {
                type: 'IPC',
                date: eneroDate,
                value: eneroIPCValue,
                interannualValue: eneroInterannual
            }
        });

        console.log('✅ IPC de Enero 2026 creado exitosamente!');
        console.log(`   ID: ${ipc.id}`);
        console.log(`   Fecha: ${new Date(ipc.date).toLocaleDateString('es-AR')}`);
        console.log(`   Valor: ${ipc.value}%`);
        console.log(`   Interanual: ${ipc.interannualValue}%\n`);

        // Ahora verificar si hay contratos que deban ajustar
        console.log('🔄 Verificando contratos que deban ajustar...\n');

        const contracts = await prisma.contract.findMany({
            where: {
                status: 'ACTIVE'
            },
            include: {
                property: true,
                tenant: true
            }
        });

        const today = new Date();
        let adjustmentsNeeded = 0;

        for (const contract of contracts) {
            const startDate = new Date(contract.startDate);
            const monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 +
                (today.getMonth() - startDate.getMonth());

            let shouldAdjust = false;
            if (contract.adjustmentFrequency === 'ANNUAL' && monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
                shouldAdjust = true;
            } else if (contract.adjustmentFrequency === 'QUARTERLY' && monthsSinceStart > 0 && monthsSinceStart % 3 === 0) {
                shouldAdjust = true;
            } else if (contract.adjustmentFrequency === 'SEMESTRIAL' && monthsSinceStart > 0 && monthsSinceStart % 6 === 0) {
                shouldAdjust = true;
            }

            if (shouldAdjust) {
                adjustmentsNeeded++;
                console.log(`📄 ${contract.property.name} - ${contract.tenant.name}`);
                console.log(`   Inicio: ${startDate.toLocaleDateString('es-AR')}`);
                console.log(`   Meses: ${monthsSinceStart} (${contract.adjustmentFrequency})`);
                console.log(`   Monto actual: $${contract.rentAmount.toLocaleString('es-AR')}\n`);
            }
        }

        if (adjustmentsNeeded === 0) {
            console.log('ℹ️  No hay contratos que deban ajustar en febrero 2026.');
            console.log('   Verifica las fechas de inicio y frecuencias.');
        } else {
            console.log(`✅ Hay ${adjustmentsNeeded} contrato(s) que deben ajustar.`);
            console.log('   El sistema debería enviar notificaciones automáticamente.\n');
        }

    } catch (error: any) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
