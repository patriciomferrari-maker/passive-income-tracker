-- CreateTable
CREATE TABLE "RentalCashflow" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "amountARS" DOUBLE PRECISION,
    "amountUSD" DOUBLE PRECISION,
    "ipcMonthly" DOUBLE PRECISION,
    "ipcAccumulated" DOUBLE PRECISION,
    "tc" DOUBLE PRECISION,
    "tcBase" DOUBLE PRECISION,
    "tcClosingMonth" DOUBLE PRECISION,
    "inflationAccum" DOUBLE PRECISION,
    "devaluationAccum" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalCashflow_pkey" PRIMARY KEY ("id")
);

-- AlterTable (Cashflow)
-- Drop column contractId
ALTER TABLE "Cashflow" DROP COLUMN "contractId";

-- Add column capitalResidual (Already added in previous migration 20251203193205)
-- ALTER TABLE "Cashflow" ADD COLUMN "capitalResidual" DOUBLE PRECISION;

-- Make investmentId required (if data exists, this might fail, but for migration fix we assume empty or valid data)
ALTER TABLE "Cashflow" ALTER COLUMN "investmentId" SET NOT NULL;


-- AlterTable (Contract)
-- Drop columns
ALTER TABLE "Contract" DROP COLUMN "endDate";
ALTER TABLE "Contract" DROP COLUMN "adjustmentFrequency";

-- Add column adjustmentPeriod
ALTER TABLE "Contract" ADD COLUMN "adjustmentPeriod" INTEGER NOT NULL DEFAULT 12;

-- CreateIndex
CREATE INDEX "RentalCashflow_contractId_idx" ON "RentalCashflow"("contractId");

-- CreateIndex
CREATE INDEX "RentalCashflow_date_idx" ON "RentalCashflow"("date");

-- CreateIndex
CREATE INDEX "Cashflow_investmentId_idx" ON "Cashflow"("investmentId");

-- CreateIndex
CREATE INDEX "Cashflow_date_idx" ON "Cashflow"("date");

-- CreateIndex
CREATE INDEX "Contract_propertyId_idx" ON "Contract"("propertyId");

-- AddForeignKey
ALTER TABLE "RentalCashflow" ADD CONSTRAINT "RentalCashflow_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Rename Constraint (if needed, but usually automatically handled by Postgres logic if dropping foreign key.. wait. 
-- The original constraints were named. Check if we need to drop old constraints first?)
-- Postgres uses explicit constraint names.
-- "Cashflow_contractId_fkey" was on contractId. Dropping the column drops the constraint.

