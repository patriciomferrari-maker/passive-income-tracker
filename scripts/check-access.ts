
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const access = await prisma.sharedAccess.findMany({
        include: {
            owner: { select: { email: true } },
            viewer: { select: { email: true } }
        }
    });
    console.log('Shared Access Records:', access);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
