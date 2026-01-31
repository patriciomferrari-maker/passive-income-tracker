
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_USER_ID = 'cmiyn97tu00004vh9teg1pnms'; // prueba (Source now)
const NEW_USER_ID = 'cmixpqcnk00003mnmljva12cg'; // Patricio (Target now)

async function main() {
    console.log(`Migrating data from ${OLD_USER_ID} to ${NEW_USER_ID}...`);

    // Verify new user exists
    const newUser = await prisma.user.findUnique({ where: { id: NEW_USER_ID } });
    if (!newUser) {
        console.error('Target user not found');
        return;
    }
    console.log(`Target User: ${newUser.email}`);

    // Update all related models
    // Models with userId: Property, Investment, Debt, BankOperation, CostaCategory, CostaTransaction, CostaNote, MonthlySummary, AppSettings

    const tables = [
        'property', 'investment', 'debt', 'bankOperation',
        'costaCategory', 'costaTransaction', 'costaNote', 'monthlySummary', 'appSettings'
    ];

    for (const table of tables) {
        try {
            const res = await prisma[table].updateMany({
                where: { userId: OLD_USER_ID },
                data: { userId: NEW_USER_ID }
            });
            console.log(`Updated ${table}: ${res.count} records`);
        } catch (e) {
            console.error(`Error updating ${table}:`, e.message);
        }
    }

    console.log('Migration complete.');
}

main()
    .finally(() => prisma.$disconnect());
