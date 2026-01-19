import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
    try {
        console.log('📊 Checking database state...\n');

        // Check if jurisdiction column exists
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Property' 
      AND column_name = 'jurisdiction';
    `;

        console.log('Jurisdiction column:', result);

        // Check properties
        const properties = await prisma.$queryRaw`
      SELECT name, jurisdiction, "userId"
      FROM "Property";
    `;

        console.log('\nProperties:');
        console.log(properties);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDatabase();
