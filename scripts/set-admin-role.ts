import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setAdminRole(email: string) {
    console.log(`🔧 Setting admin role for: ${email}`);

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, role: true }
        });

        if (!user) {
            console.error(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log(`Found user: ${user.name} (${user.email})`);
        console.log(`Current role: ${user.role}`);

        if (user.role === 'ADMIN') {
            console.log(`✅ User is already an admin!`);
            process.exit(0);
        }

        await prisma.user.update({
            where: { email },
            data: { role: 'ADMIN' }
        });

        console.log(`✅ Successfully promoted ${email} to ADMIN`);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

const email = process.argv[2];

if (!email) {
    console.error('Usage: npx tsx scripts/set-admin-role.ts your-email@example.com');
    process.exit(1);
}

setAdminRole(email);
