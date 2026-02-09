import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Find the incorrect entry: 5% saved as 2026-01-01 (should be enero)
    const incorrectEntry = await prisma.economicIndicator.findFirst({
        where: {
            type: 'IPC',
            value: 5,
            date: {
                gte: new Date('2025-12-31'),
                lte: new Date('2026-01-02')
            }
        }
    });

    if (!incorrectEntry) {
        console.log('❌ No se encontró la entrada incorrecta (5%)');
        return;
    }

    console.log('\n📝 Entrada encontrada:');
    console.log(`   ID: ${incorrectEntry.id}`);
    console.log(`   Fecha (BD): ${incorrectEntry.date.toISOString()}`);
    console.log(`   Fecha (AR): ${incorrectEntry.date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}`);
    console.log(`   Valor: ${incorrectEntry.value}%`);

    // Update to correct date: January 31, 2026 at noon UTC
    const correctDate = new Date('2026-01-31');
    correctDate.setUTCHours(12, 0, 0, 0);

    console.log('\n🔧 Corrigiendo fecha a:');
    console.log(`   Nueva fecha (BD): ${correctDate.toISOString()}`);
    console.log(`   Nueva fecha (AR): ${correctDate.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}`);

    const updated = await prisma.economicIndicator.update({
        where: { id: incorrectEntry.id },
        data: { date: correctDate }
    });

    console.log('\n✅ Entrada corregida exitosamente!');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Nueva fecha: ${updated.date.toISOString()}`);
    console.log(`   Valor: ${updated.value}%`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
