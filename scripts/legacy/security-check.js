
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function audit() {
    console.log('--- STARTING DEEP SECURITY AUDIT ---');

    // 1. Find ALL properties with "Heroes" in the name
    const heroesProps = await prisma.property.findMany({
        where: { name: { contains: 'Heroes', mode: 'insensitive' } },
        include: { user: true }
    });

    console.log(`\nFound ${heroesProps.length} properties named "Heroes":`);
    heroesProps.forEach(p => {
        console.log(`   - ID: ${p.id}`);
        console.log(`     Name: ${p.name}`);
        console.log(`     Owner: ${p.user.email} (ID: ${p.userId})`);
    });

    // 2. Audit the "Admin" user specifically (from the URL we saw)
    // URL ID: cmixkx9xi0000o235ll480bf3
    const targetId = 'cmixkx9xi0000o235ll480bf3';

    const adminProps = await prisma.property.findMany({
        where: { userId: targetId },
        select: { id: true, name: true }
    });

    console.log(`\nProperties owned by Admin (ID: ${targetId}):`);
    if (adminProps.length === 0) {
        console.log('   (No properties found)');
    } else {
        adminProps.forEach(p => console.log(`   - [${p.id}] ${p.name}`));
    }

    console.log('\n--- END AUDIT ---');
}

audit()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
