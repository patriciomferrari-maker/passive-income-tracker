import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🧹 Limpieza de IPC duplicado - Diciembre 2025\n');

    // Find all December 2025 entries
    const decemberIPCs = await prisma.economicIndicator.findMany({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2025, 11, 1),  // Dec 1, 2025
                lt: new Date(2026, 0, 1)     // Before Jan 1, 2026
            }
        },
        orderBy: { date: 'desc' }
    });

    console.log(`Entradas de Diciembre 2025 encontradas: ${decemberIPCs.length}\n`);

    if (decemberIPCs.length === 0) {
        console.log('✅ No hay entradas de diciembre 2025.');
        return;
    }

    if (decemberIPCs.length === 1) {
        console.log('✅ Solo hay 1 entrada, no hay duplicados.');
        const ipc = decemberIPCs[0];
        console.log(`   Valor: ${ipc.value}%`);
        console.log(`   Interanual: ${ipc.interannualValue ?? '-'}`);
        return;
    }

    console.log('⚠️  Encontrados múltiples registros:\n');

    decemberIPCs.forEach((ipc, i) => {
        const date = new Date(ipc.date);
        console.log(`${i + 1}. ID: ${ipc.id}`);
        console.log(`   Fecha: ${date.toISOString()}`);
        console.log(`   Día: ${date.getDate()}`);
        console.log(`   Valor: ${ipc.value}%`);
        console.log(`   Interanual: ${ipc.interannualValue ?? 'null'}`);
        console.log('');
    });

    // Strategy: Keep the one with interannualValue (31.5%), it's from the scraper
    // Delete the one without interannualValue or with less complete data

    const toKeep = decemberIPCs.find(ipc => ipc.interannualValue !== null);
    const toDelete = decemberIPCs.filter(ipc => ipc.id !== toKeep?.id);

    if (!toKeep) {
        console.log('⚠️  No se pudo determinar cuál mantener (ninguno tiene interannualValue)');
        console.log('   Se mantendrá el más reciente por fecha.');
        // Keep first (most recent by date)
        const keep = decemberIPCs[0];
        const del = decemberIPCs.slice(1);

        console.log(`\n✅ Manteniendo: ${keep.value}% (ID: ${keep.id})`);
        console.log(`❌ Eliminando: ${del.length} registro(s)\n`);

        for (const ipc of del) {
            await prisma.economicIndicator.delete({
                where: { id: ipc.id }
            });
            console.log(`   🗑️  Eliminado: ${ipc.value}% (ID: ${ipc.id})`);
        }
    } else {
        console.log(`\n✅ Manteniendo: ${toKeep.value}% con interanual ${toKeep.interannualValue}% (ID: ${toKeep.id})`);
        console.log(`❌ Eliminando: ${toDelete.length} registro(s)\n`);

        for (const ipc of toDelete) {
            await prisma.economicIndicator.delete({
                where: { id: ipc.id }
            });
            console.log(`   🗑️  Eliminado: ${ipc.value}% (ID: ${ipc.id})`);
        }
    }

    console.log('\n✅ Limpieza completada!\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
