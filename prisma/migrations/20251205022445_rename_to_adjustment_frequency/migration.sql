-- AlterTable
ALTER TABLE "Contract" DROP COLUMN "adjustmentPeriod",
ADD COLUMN "adjustmentFrequency" INTEGER NOT NULL DEFAULT 12;

-- The other indices and constraints remain if not touched.

