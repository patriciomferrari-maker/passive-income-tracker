import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
    try {
        console.log('📋 Running jurisdiction migration...\n');

        // Step 1: Create enum
        console.log('1. Creating Jurisdiction enum...');
        try {
            await prisma.$executeRaw`CREATE TYPE "Jurisdiction" AS ENUM ('CABA', 'PROVINCIA');`;
            console.log('   ✅ Enum created');
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                console.log('   ⚠️  Enum already exists, skipping');
            } else {
                throw error;
            }
        }

        // Step 2: Add column
        console.log('2. Adding jurisdiction column...');
        try {
            await prisma.$executeRaw`
        ALTER TABLE "Property" 
        ADD COLUMN "jurisdiction" "Jurisdiction" NOT NULL DEFAULT 'PROVINCIA';
      `;
            console.log('   ✅ Column added');
        } catch (error: any) {
            if (error.message.includes('already exists')) {
                console.log('   ⚠️  Column already exists, skipping');
            } else {
                throw error;
            }
        }

        // Step 3: Update Soldado property
        console.log('3. Updating Soldado property to CABA...');
        const result = await prisma.$executeRaw`
      UPDATE "Property" 
      SET "jurisdiction" = 'CABA'::"Jurisdiction"
      WHERE "name" = 'Soldado' 
        AND "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'paato.ferrari@hotmail.com');
    `;
        console.log(`   ✅ Updated ${result} property`);

        // Step 4: Verify
        console.log('\n4. Verifying properties:');
        const properties = await prisma.$queryRaw<Array<{ name: string, jurisdiction: string, email: string }>>`
      SELECT p.name, p.jurisdiction, u.email
      FROM "Property" p
      JOIN "User" u ON p."userId" = u.id
      ORDER BY p.name;
    `;

        properties.forEach(p => {
            console.log(`   - ${p.name} (${p.email}): ${p.jurisdiction}`);
        });

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

runMigration();
