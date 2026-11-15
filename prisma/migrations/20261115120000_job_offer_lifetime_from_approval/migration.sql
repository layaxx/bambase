-- The lifetime of an offer now starts at its first approval.
ALTER TABLE "job_offer" ALTER COLUMN "offlineAfter" DROP NOT NULL;

-- Offers in review get their lifetime when approved. An offer that was published before and is
-- back in review thus gets one new lifetime, once.
UPDATE "job_offer" SET "offlineAfter" = NULL WHERE "onlineStatus" IN ('submitted', 'rejected');
