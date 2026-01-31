
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users found:', users.length);
    users.forEach(u => console.log(`${u.id} - ${u.email} - ${u.name}`));
}

main().finally(() => prisma.$disconnect());
