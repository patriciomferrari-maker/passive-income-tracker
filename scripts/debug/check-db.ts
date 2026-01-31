import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkConnection() {
    try {
        console.log('Testing connection...');
        const userCount = await prisma.user.count();
        console.log(`Connection successful! Found ${userCount} users.`);
    } catch (error) {
        console.error('Connection failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkConnection();
