import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n📊 Rango de fechas de datos económicos:\n');

    // IPC (Inflación)
    const ipcData = await prisma.economicIndicator.findMany({
        where: { type: 'IPC' },
        orderBy: { date: 'asc' },
        select: { date: true, value: true, interannualValue: true }
    });

    if (ipcData.length > 0) {
        const firstIPC = ipcData[0];
        const lastIPC = ipcData[ipcData.length - 1];

        console.log('💹 INFLACIÓN (IPC Mensual):');
        console.log(`   Primer registro: ${firstIPC.date.toLocaleDateString('es-AR')} - ${firstIPC.value}%`);
        console.log(`   Último registro: ${lastIPC.date.toLocaleDateString('es-AR')} - ${lastIPC.value}%`);
        console.log(`   Total registros: ${ipcData.length}`);

        const withInterannual = ipcData.filter(d => d.interannualValue !== null).length;
        console.log(`   Con valor interanual: ${withInterannual} (${((withInterannual / ipcData.length) * 100).toFixed(1)}%)`);
    } else {
        console.log('💹 INFLACIÓN (IPC): No hay datos');
    }

    console.log('');

    // Dólar Blue (TC_USD_ARS)
    const dollarData = await prisma.economicIndicator.findMany({
        where: { type: 'TC_USD_ARS' },
        orderBy: { date: 'asc' },
        select: { date: true, value: true }
    });

    if (dollarData.length > 0) {
        const firstDollar = dollarData[0];
        const lastDollar = dollarData[dollarData.length - 1];

        console.log('💵 DÓLAR BLUE (TC_USD_ARS):');
        console.log(`   Primer registro: ${firstDollar.date.toLocaleDateString('es-AR')} - $${firstDollar.value}`);
        console.log(`   Último registro: ${lastDollar.date.toLocaleDateString('es-AR')} - $${lastDollar.value}`);
        console.log(`   Total registros: ${dollarData.length}`);
    } else {
        console.log('💵 DÓLAR BLUE: No hay datos');
    }

    console.log('');

    // TC Oficial
    const tcOficialData = await prisma.economicIndicator.findMany({
        where: { type: 'TC_OFICIAL' },
        orderBy: { date: 'asc' },
        select: { date: true, value: true }
    });

    if (tcOficialData.length > 0) {
        const firstTC = tcOficialData[0];
        const lastTC = tcOficialData[tcOficialData.length - 1];

        console.log('💱 DÓLAR OFICIAL (TC_OFICIAL):');
        console.log(`   Primer registro: ${firstTC.date.toLocaleDateString('es-AR')} - $${firstTC.value}`);
        console.log(`   Último registro: ${lastTC.date.toLocaleDateString('es-AR')} - $${lastTC.value}`);
        console.log(`   Total registros: ${tcOficialData.length}`);
    } else {
        console.log('💱 DÓLAR OFICIAL: No hay datos');
    }

    console.log('\n---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
