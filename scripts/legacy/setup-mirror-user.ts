
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// CONFIGURATION
const SOURCE_EMAIL = 'patriciomferrari@gmail.com';
const MIRROR_EMAIL = 'valeriabarbosa22@gmail.com';
const MIRROR_PASSWORD = 'Password123!';
const MIRROR_NAME = 'Valeria Barbosa';

async function main() {
    console.log(`🚀 Setting up Mirror Account...`);
    console.log(`Target: ${MIRROR_EMAIL} will view data of ${SOURCE_EMAIL}`);

    // 1. Find Source User
    const sourceUser = await prisma.user.findUnique({
        where: { email: SOURCE_EMAIL }
    });

    if (!sourceUser) {
        throw new Error(`Source user ${SOURCE_EMAIL} not found. Please register it first.`);
    }

    console.log(`✅ Found Source User: ${sourceUser.name} (${sourceUser.id})`);

    // 2. Hash Password
    const hashedPassword = await bcrypt.hash(MIRROR_PASSWORD, 10);

    // 3. Create or Update Mirror User
    const mirrorUser = await prisma.user.upsert({
        where: { email: MIRROR_EMAIL },
        update: {
            password: hashedPassword,
            dataOwnerId: sourceUser.id,
            name: MIRROR_NAME
        },
        create: {
            email: MIRROR_EMAIL,
            password: hashedPassword,
            name: MIRROR_NAME,
            role: 'USER',
            dataOwnerId: sourceUser.id
        }
    });

    console.log(`✅ Mirror User Linked!`);
    console.log('------------------------------------------------');
    console.log(`Email:    ${mirrorUser.email}`);
    console.log(`Password: ${MIRROR_PASSWORD}`);
    console.log(`Role:     ${mirrorUser.role}`);
    console.log(`Access:   Views data of ${sourceUser.email}`);
    console.log('------------------------------------------------');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());
