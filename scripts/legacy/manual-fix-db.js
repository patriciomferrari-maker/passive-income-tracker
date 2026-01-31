const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Checking database connection...');
        // Simple query to wake up
        await prisma.user.count();
        console.log('Connected.');

        // Check if column exists by trying to access it via raw query on information_schema or just trying a select
        // We'll use information_schema
        const columns = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name IN ('resetToken', 'resetTokenExpiry');
    `;

        console.log('Found columns:', columns);

        if (columns.length < 2) {
            console.log('Columns missing. Attempting manual ALTER TABLE...');

            try {
                await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetToken" TEXT;`;
                console.log('Added resetToken.');

                await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenExpiry" TIMESTAMP(3);`;
                console.log('Added resetTokenExpiry.');

                // Add unique index
                try {
                    await prisma.$executeRaw`CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");`;
                    console.log('Created index.');
                } catch (e) {
                    console.log('Index might already exist or failed:', e.message);
                }

                console.log('Manual migration completed.');
            } catch (e) {
                console.error('Migration failed:', e);
            }
        } else {
            console.log('Columns already exist in the database connected to this script.');
            // If they exist here but not in the app, the app is using a different DB.
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
