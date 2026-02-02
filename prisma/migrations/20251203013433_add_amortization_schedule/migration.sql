-- AlterTable
ALTER TABLE "Investment" ADD COLUMN "emissionDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AmortizationSchedule" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmortizationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmortizationSchedule_investmentId_paymentDate_key" ON "AmortizationSchedule"("investmentId", "paymentDate");

-- AddForeignKey
ALTER TABLE "AmortizationSchedule" ADD CONSTRAINT "AmortizationSchedule_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
