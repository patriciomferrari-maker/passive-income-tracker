-- CreateTable
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UtilityCheck_propertyId_serviceType_idx" ON "UtilityCheck"("propertyId", "serviceType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UtilityCheck_checkDate_idx" ON "UtilityCheck"("checkDate");

-- AddForeignKey
ALTER TABLE "UtilityCheck" ADD CONSTRAINT "UtilityCheck_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
