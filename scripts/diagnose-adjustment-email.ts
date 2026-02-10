import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('\n🔍 Diagnóstico de emails de ajuste - Febrero 2026\n');

    // 1. Verificar IPC de enero 2026
    console.log('📊 Verificando IPC de enero 2026...\n');
    const eneroIPC = await prisma.economicIndicator.findFirst({
        where: {
            type: 'IPC',
            date: {
                gte: new Date(2026, 0, 1), // Enero 2026
                lt: new Date(2026, 1, 1)   // Antes de Febrero 2026
            }
        }
    });

    if (!eneroIPC) {
        console.log('❌ ERROR: No se encontró IPC de enero 2026');
        console.log('   Sin este dato, no se pueden generar ajustes para febrero.\n');
        return;
    }

    console.log('✅ IPC Enero 2026 encontrado:');
    console.log(`   Fecha: ${eneroIPC.date.toLocaleDateString('es-AR')}`);
    console.log(`   Valor: ${eneroIPC.value}%`);
    console.log(`   Interanual: ${eneroIPC.interannualValue}%\n`);

    // 2. Buscar contratos que deberían ajustar en febrero 2026
    console.log('📋 Buscando contratos que ajustan en febrero 2026...\n');

    const contracts = await prisma.contract.findMany({
        where: {
            status: 'ACTIVE'
        },
        include: {
            tenant: true,
            property: true
        }
    });

    console.log(`Total contratos activos: ${contracts.length}\n`);

    const today = new Date();
    const contractsToAdjust = [];

    for (const contract of contracts) {
        const startDate = new Date(contract.startDate);
        const monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 +
            (today.getMonth() - startDate.getMonth());

        // Check if adjustment is due this month
        if (contract.adjustmentFrequency === 'ANNUAL' && monthsSinceStart > 0 && monthsSinceStart % 12 === 0) {
            contractsToAdjust.push(contract);
        } else if (contract.adjustmentFrequency === 'QUARTERLY' && monthsSinceStart > 0 && monthsSinceStart % 3 === 0) {
            contractsToAdjust.push(contract);
        } else if (contract.adjustmentFrequency === 'SEMESTRIAL' && monthsSinceStart > 0 && monthsSinceStart % 6 === 0) {
            contractsToAdjust.push(contract);
        }
    }

    console.log(`Contratos que deberían ajustar en ${today.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}: ${contractsToAdjust.length}\n`);

    if (contractsToAdjust.length === 0) {
        console.log('ℹ️  No hay contratos que deban ajustar este mes.');
        console.log('   Verifica las fechas de inicio y frecuencia de ajuste.\n');
    } else {
        contractsToAdjust.forEach(contract => {
            const startDate = new Date(contract.startDate);
            const monthsSinceStart = (today.getFullYear() - startDate.getFullYear()) * 12 +
                (today.getMonth() - startDate.getMonth());

            console.log(`📄 ${contract.property.name} - ${contract.tenant.name}`);
            console.log(`   Inicio: ${startDate.toLocaleDateString('es-AR')}`);
            console.log(`   Meses desde inicio: ${monthsSinceStart}`);
            console.log(`   Frecuencia: ${contract.adjustmentFrequency}`);
            console.log(`   Monto actual: $${contract.rentAmount.toLocaleString('es-AR')}\n`);
        });
    }

    // 3. Verificar emails enviados recientemente
    console.log('📧 Verificando emails enviados en los últimos 7 días...\n');

    const recentEmails = await prisma.emailLog.findMany({
        where: {
            createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    if (recentEmails.length === 0) {
        console.log('⚠️  No hay emails registrados en los últimos 7 días.\n');
    } else {
        console.log(`Total emails recientes: ${recentEmails.length}\n`);
        recentEmails.forEach(email => {
            const status = email.status === 'SENT' ? '✅' : '❌';
            console.log(`${status} ${email.subject}`);
            console.log(`   Para: ${email.to}`);
            console.log(`   Fecha: ${new Date(email.createdAt).toLocaleString('es-AR')}`);
            console.log(`   Estado: ${email.status}`);
            if (email.error) {
                console.log(`   Error: ${email.error}`);
            }
            console.log('');
        });
    }

    // 4. Verificar notificaciones de ajuste
    console.log('🔔 Verificando notificaciones de ajuste...\n');

    const adjustmentNotifications = await prisma.notification.findMany({
        where: {
            type: 'ADJUSTMENT_DUE',
            createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (adjustmentNotifications.length === 0) {
        console.log('⚠️  No hay notificaciones de ajuste en los últimos 30 días.');
        console.log('   Esto podría indicar que el sistema automático no está corriendo.\n');
    } else {
        console.log(`Notificaciones encontradas: ${adjustmentNotifications.length}\n`);
        adjustmentNotifications.slice(0, 5).forEach(notif => {
            console.log(`🔔 ${notif.title}`);
            console.log(`   Fecha: ${new Date(notif.createdAt).toLocaleString('es-AR')}`);
            console.log(`   Leída: ${notif.isRead ? 'Sí' : 'No'}\n`);
        });
    }

    console.log('---\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
