-- DropIndex
DROP INDEX "job_offer_onlineStatus_idx";

-- AlterTable
ALTER TABLE "job_offer" ADD COLUMN     "offlineAfter" TIMESTAMP(3);

-- Backfill existing rows as if they had been created with the default 30-day expiry window
UPDATE "job_offer" SET "offlineAfter" = "createdAt" + INTERVAL '30 days' WHERE "offlineAfter" IS NULL;

-- AlterTable
ALTER TABLE "job_offer" ALTER COLUMN "offlineAfter" SET NOT NULL;

-- CreateIndex
CREATE INDEX "job_offer_onlineStatus_offlineAfter_idx" ON "job_offer"("onlineStatus", "offlineAfter");
