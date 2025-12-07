/*
  Warnings:

  - You are about to drop the column `adjustmentPeriod` on the `Contract` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "tenantName" TEXT,
    "startDate" DATETIME NOT NULL,
    "durationMonths" INTEGER NOT NULL DEFAULT 12,
    "initialRent" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "adjustmentType" TEXT NOT NULL DEFAULT 'IPC',
    "adjustmentFrequency" INTEGER NOT NULL DEFAULT 12,
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
