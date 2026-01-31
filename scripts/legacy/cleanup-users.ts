
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEEP_EMAILS = [
    'ferra.tomy@gmail.com',
    'paato.ferrari@hotmail.com',
    'patriciomferrari@gmail.com'
];

async function main() {
    console.log('--- User Cleanup ---');
    console.log('Keeping users:', KEEP_EMAILS);

    // 1. Find users to delete
    const allUsers = await prisma.user.findMany();
    const toDelete = allUsers.filter(u => !KEEP_EMAILS.includes(u.email));

    console.log(`Found ${allUsers.length} total users.`);
    console.log(`Found ${toDelete.length} users to delete.`);

    if (toDelete.length === 0) {
        console.log('No users to delete.');
        return;
    }

    // 2. Delete them
    for (const u of toDelete) {
        console.log(`Deleting user: ${u.email} (${u.name}) - ID: ${u.id}`);
        try {
            // Check if they own data that might be problematic? 
            // Cascade delete is usually configured in schema, so valid.
            await prisma.user.delete({ where: { id: u.id } });
            console.log('  -> Deleted.');
        } catch (e) {
            console.error(`  -> Error deleting ${u.email}:`, e.message);
        }
    }

    console.log('--- Cleanup Complete ---');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
