import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📋 Verificando contratos que deben ajustar en Febrero 2026\n');

    const contracts = await prisma.contract.findMany({
        where: {
            adjustmentType: 'IPC'
        },
        include: {
            property: true,
            tenant: true
        }
    });

    console.log(`Total contratos con ajuste IPC: ${contracts.length}\n`);

    const today = new Date(); // February 10, 2026
    console.log(`Fecha de hoy: ${today.toLocaleDateString('es-AR')}\n`);

    let adjustmentsNeeded = 0;

    for (const contract of contracts) {
        const startDate = new Date(contract.startDate);
        const monthsPassed = (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());

        // Map frequency name to number
        let frequencyMonths = 0;
        switch (contract.adjustmentFrequency) {
            case 'QUARTERLY':
                frequencyMonths = 3;
                break;
            case 'SEMESTRIAL':
                frequencyMonths = 6;
                break;
            case 'ANNUAL':
                frequencyMonths = 12;
                break;
        }

        const shouldAdjust = monthsPassed > 0 && monthsPassed % frequencyMonths === 0;

        console.log(`📄 ${contract.property.name} - ${contract.tenant.name}`);
        console.log(`   Inicio: ${startDate.toLocaleDateString('es-AR')}`);
        console.log(`   Meses transcurridos: ${monthsPassed}`);
        console.log(`   Frecuencia: ${contract.adjustmentFrequency} (cada ${frequencyMonths} meses)`);
        console.log(`   ¿Debe ajustar? ${shouldAdjust ? '✅ SÍ' : '❌ NO'}`);
        console.log(`   Cálculo: ${monthsPassed} % ${frequencyMonths} = ${monthsPassed % frequencyMonths}\n`);

        if (shouldAdjust) {
            adjustmentsNeeded++;
        }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total que deben ajustar: ${adjustmentsNeeded}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (adjustmentsNeeded > 0) {
        console.log('💡 Sugerencia: Ejecutar manualmente la verificación con:');
        console.log('   curl http://localhost:3000/api/test/check-adjustments\n');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
