-- AlterTable
ALTER TABLE "job_offer" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "job_offer_externalId_key" ON "job_offer"("externalId");
