
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Checking Transaction table schema...');
    try {
        // Try to query the table structure using raw SQL
        // This query works for PostgreSQL which is likely what is being used (Supabase/Vercel Postgres)
        const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'Transaction' AND column_name = 'notes';
    `;

        console.log('Query result:', result);

        if (Array.isArray(result) && result.length > 0) {
            console.log("SUCCESS: 'notes' column found in Transaction table.");
        } else {
            console.log("FAILURE: 'notes' column NOT found in Transaction table.");
        }

        // Also try to create a dummy transaction to see if it throws
        // We won't actually save it, just check if the model is compatible
        console.log('Verifying Prisma Client model...');
        try {
            // Just checking if the types allow it (runtime check)
            const modelFields = PrismaClient.dmmf.datamodel.models.find(m => m.name === 'Transaction')?.fields;
            const notesField = modelFields?.find(f => f.name === 'notes');

            // Note: dmmf access might not be available at runtime in this way depending on generation.
            // So we will rely on the SQL check primarily.
        } catch (e) {
            console.log('Could not check DMMF', e);
        }

    } catch (error) {
        console.error('Error checking schema:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
