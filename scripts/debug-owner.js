
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const inv = await prisma.investment.findFirst({
            where: { ticker: 'DNC5D' },
            include: { user: true }
        });
        if (inv) {
            console.log(`Owner of DNC5D: ${inv.user.email} (ID: ${inv.userId})`);
            console.log(`Market: ${inv.market}`);
            console.log(`Type: ${inv.type}`);
        } else {
            console.log("DNC5D not found!");
        }
    } catch (e) { console.error(e); }
    finally { await prisma.$disconnect(); }
}
main();
