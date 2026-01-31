
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error("Please provide user email as argument: npx tsx scripts/assign-orphaned-data.ts user@example.com");
        process.exit(1);
    }

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error(`User with email ${email} not found.`);
        process.exit(1);
    }

    console.log(`Found User: ${user.name} (${user.id})`);
    console.log("Starting adoption of orphaned data...");

    const updates = [
        // prisma.property.updateMany({ where: { userId: null }, data: { userId: user.id } }), // UserId is required, no orphans possible
        // prisma.investment.updateMany({ where: { userId: null }, data: { userId: user.id } }),
        // prisma.debt.updateMany({ where: { userId: null }, data: { userId: user.id } }),
        // prisma.bankOperation.updateMany({ where: { userId: null }, data: { userId: user.id } }),
        // prisma.costaCategory.updateMany({ where: { userId: null }, data: { userId: user.id } }),

        // These are the ones we made Optional to save the data:
        prisma.costaTransaction.updateMany({ where: { userId: null }, data: { userId: user.id } }),
        prisma.costaNote.updateMany({ where: { userId: null }, data: { userId: user.id } }),
    ];

    const results = await Promise.all(updates);

    console.log("Data adoption complete!");
    console.log(`- Properties: ${results[0].count}`);
    console.log(`- Investments: ${results[1].count}`);
    console.log(`- Debts: ${results[2].count}`);
    console.log(`- Bank Ops: ${results[3].count}`);
    console.log(`- Costa Cats: ${results[4].count}`);
    console.log(`- Costa Tx: ${results[5].count}`);
    console.log(`- Costa Notes: ${results[6].count}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
