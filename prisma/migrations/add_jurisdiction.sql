-- Add Jurisdiction enum
CREATE TYPE "Jurisdiction" AS ENUM ('CABA', 'PROVINCIA');

-- Add jurisdiction column to Property table with default PROVINCIA
ALTER TABLE "Property" 
ADD COLUMN "jurisdiction" "Jurisdiction" NOT NULL DEFAULT 'PROVINCIA';

-- Update Soldado property to CABA (assuming it belongs to paato.ferrari@hotmail.com)
UPDATE "Property" 
SET "jurisdiction" = 'CABA'
WHERE "name" = 'Soldado' 
  AND "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'paato.ferrari@hotmail.com');
