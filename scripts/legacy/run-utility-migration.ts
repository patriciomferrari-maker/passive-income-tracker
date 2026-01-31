import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
    console.log('🔧 Running manual UtilityCheck migration...');

    try {
        // Create UtilityCheck table
        await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "UtilityCheck" (
          "id" TEXT NOT NULL,
          "propertyId" TEXT NOT NULL,
          "serviceType" TEXT NOT NULL,
          "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "status" TEXT NOT NULL,
          "debtAmount" DOUBLE PRECISION,
          "lastBillAmount" DOUBLE PRECISION,
          "lastBillDate" TIMESTAMP(3),
          "dueDate" TIMESTAMP(3),
          "accountNumber" TEXT,
          "notes" TEXT,
          "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
          "errorMessage" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

          CONSTRAINT "UtilityCheck_pkey" PRIMARY KEY ("id")
      );
    `);

        console.log('✅ Table created');

        // Create indexes
        await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "UtilityCheck_propertyId_serviceType_idx" 
      ON "UtilityCheck"("propertyId", "serviceType");
    `);

        console.log('✅ Index 1 created');

        await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "UtilityCheck_checkDate_idx" 
      ON "UtilityCheck"("checkDate");
    `);

        console.log('✅ Index 2 created');

        // Add foreign key
        await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'UtilityCheck_propertyId_fkey'
        ) THEN
          ALTER TABLE "UtilityCheck" 
          ADD CONSTRAINT "UtilityCheck_propertyId_fkey" 
          FOREIGN KEY ("propertyId") 
          REFERENCES "Property"("id") 
          ON DELETE CASCADE 
          ON UPDATE CASCADE;
        END IF;
      END $$;
    `);

        console.log('✅ Foreign key created');
        console.log('🎉 Migration complete!');

    } catch (error: any) {
        console.error('❌ Migration failed:', error.message);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
