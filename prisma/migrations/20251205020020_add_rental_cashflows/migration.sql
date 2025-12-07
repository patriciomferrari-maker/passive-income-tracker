/*
  Warnings:

  - You are about to drop the column `contractId` on the `Cashflow` table. All the data in the column will be lost.
  - You are about to drop the column `adjustmentFrequency` on the `Contract` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Contract` table. All the data in the column will be lost.
  - Made the column `investmentId` on table `Cashflow` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "RentalCashflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contractId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "amountARS" REAL,
    "amountUSD" REAL,
    "ipcMonthly" REAL,
    "ipcAccumulated" REAL,
    "tc" REAL,
    "tcBase" REAL,
    "tcClosingMonth" REAL,
    "inflationAccum" REAL,
    "devaluationAccum" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RentalCashflow_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Cashflow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "investmentId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROJECTED',
    "description" TEXT,
    "capitalResidual" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Cashflow_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Cashflow" ("amount", "capitalResidual", "createdAt", "currency", "date", "description", "id", "investmentId", "status", "type", "updatedAt") SELECT "amount", "capitalResidual", "createdAt", "currency", "date", "description", "id", "investmentId", "status", "type", "updatedAt" FROM "Cashflow";
DROP TABLE "Cashflow";
ALTER TABLE "new_Cashflow" RENAME TO "Cashflow";
CREATE INDEX "Cashflow_investmentId_idx" ON "Cashflow"("investmentId");
CREATE INDEX "Cashflow_date_idx" ON "Cashflow"("date");
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "tenantName" TEXT,
    "startDate" DATETIME NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 12,
    "initialRent" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "adjustmentType" TEXT NOT NULL DEFAULT 'IPC',
    "adjustmentPeriod" INTEGER NOT NULL DEFAULT 12,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("adjustmentType", "createdAt", "currency", "durationMonths", "id", "initialRent", "propertyId", "startDate", "tenantName", "updatedAt") SELECT "adjustmentType", "createdAt", "currency", "durationMonths", "id", "initialRent", "propertyId", "startDate", "tenantName", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE INDEX "Contract_propertyId_idx" ON "Contract"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RentalCashflow_contractId_idx" ON "RentalCashflow"("contractId");

-- CreateIndex
CREATE INDEX "RentalCashflow_date_idx" ON "RentalCashflow"("date");
