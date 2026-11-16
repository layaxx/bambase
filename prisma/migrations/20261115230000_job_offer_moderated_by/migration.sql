-- AlterTable
ALTER TABLE "job_offer" ADD COLUMN "moderatedById" TEXT;

-- AddForeignKey
ALTER TABLE "job_offer" ADD CONSTRAINT "job_offer_moderatedById_fkey" FOREIGN KEY ("moderatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
