import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkMirrorAccounts() {
    console.log('🔍 Checking Mirror Account Configuration...\n');

    // Get Patricio's account
    const patricio = await prisma.user.findUnique({
        where: { email: 'patriciomferrari@gmail.com' },
        select: { id: true, name: true, email: true, role: true, dataOwnerId: true }
    });

    if (!patricio) {
        console.error('❌ Patricio account not found!');
        return;
    }

    console.log('✅ Main Account (Patricio):');
    console.log(`   ID: ${patricio.id}`);
    console.log(`   Name: ${patricio.name}`);
    console.log(`   Email: ${patricio.email}`);
    console.log(`   Role: ${patricio.role}`);
    console.log(`   dataOwnerId: ${patricio.dataOwnerId || 'null (owns own data)'}\n`);

    // Get Carlos's account
    const carlos = await prisma.user.findUnique({
        where: { email: 'carlosmariaferrari@gmail.com' },
        select: { id: true, name: true, email: true, role: true, dataOwnerId: true }
    });

    if (!carlos) {
        console.error('❌ Carlos account not found!');
        return;
    }

    console.log('🔍 Mirror Account (Carlos):');
    console.log(`   ID: ${carlos.id}`);
    console.log(`   Name: ${carlos.name}`);
    console.log(`   Email: ${carlos.email}`);
    console.log(`   Role: ${carlos.role}`);
    console.log(`   dataOwnerId: ${carlos.dataOwnerId || 'null (NOT CONFIGURED!)'}\n`);

    // Check if properly configured
    if (carlos.dataOwnerId === patricio.id) {
        console.log('✅ Mirror is CORRECTLY configured!');
        console.log(`   Carlos will see Patricio's data.`);
    } else if (!carlos.dataOwnerId) {
        console.log('⚠️  Mirror is NOT configured!');
        console.log(`   Carlos has no dataOwnerId set.`);
        console.log(`   To fix, run: UPDATE User SET dataOwnerId = '${patricio.id}' WHERE id = '${carlos.id}'`);
    } else {
        console.log('⚠️  Mirror is configured but pointing to wrong user!');
        console.log(`   Carlos.dataOwnerId = ${carlos.dataOwnerId}`);
        console.log(`   Expected: ${patricio.id}`);
    }

    await prisma.$disconnect();
}

checkMirrorAccounts().catch(console.error);
