
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const tickers = ['VSCRO', 'PN36D', 'RUCDO', 'VSCRD'];
    const invs = await prisma.investment.findMany({
        where: { ticker: { in: tickers } }
    });
    console.log(invs);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
