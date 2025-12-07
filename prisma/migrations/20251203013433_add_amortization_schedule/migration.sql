-- AlterTable
ALTER TABLE "Investment" ADD COLUMN "emissionDate" DATETIME;

-- CreateTable
CREATE TABLE "AmortizationSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investmentId" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "percentage" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AmortizationSchedule_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AmortizationSchedule_investmentId_paymentDate_key" ON "AmortizationSchedule"("investmentId", "paymentDate");
