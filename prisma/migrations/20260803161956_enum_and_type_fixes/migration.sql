-- CreateEnum
CREATE TYPE "event_category" AS ENUM ('university', 'sport', 'party', 'culture', 'social', 'other');

-- CreateEnum
CREATE TYPE "location_category" AS ENUM ('university', 'mensa', 'library', 'sport', 'venues', 'other');

-- CreateEnum
CREATE TYPE "job_type" AS ENUM ('part_time', 'internship', 'working_student', 'research_assistant', 'thesis', 'volunteer', 'other');

-- CreateEnum
CREATE TYPE "job_field" AS ENUM ('it', 'marketing', 'administration', 'research', 'gastronomy', 'retail', 'education', 'other');

-- CreateEnum
CREATE TYPE "work_mode" AS ENUM ('on_site', 'hybrid', 'remote');

-- CreateEnum
CREATE TYPE "job_online_status" AS ENUM ('submitted', 'published', 'expired', 'rejected', 'archived');

-- CreateEnum
CREATE TYPE "report_reason" AS ENUM ('spam', 'inappropriate', 'outdated', 'other');

-- CreateEnum
CREATE TYPE "report_review_status" AS ENUM ('open', 'dismissed');

-- AlterTable: event.category (String -> EventCategory), preserving existing data
ALTER TABLE "event" ALTER COLUMN "category" TYPE "event_category" USING ("category"::"event_category");

-- AlterTable: job_offer.onlineStatus/jobType/field/workMode (String -> enums), preserving existing data
ALTER TABLE "job_offer" ALTER COLUMN "onlineStatus" DROP DEFAULT;
ALTER TABLE "job_offer" ALTER COLUMN "onlineStatus" TYPE "job_online_status" USING ("onlineStatus"::"job_online_status");
ALTER TABLE "job_offer" ALTER COLUMN "onlineStatus" SET DEFAULT 'submitted';
ALTER TABLE "job_offer" ALTER COLUMN "jobType" TYPE "job_type" USING ("jobType"::"job_type");
ALTER TABLE "job_offer" ALTER COLUMN "field" TYPE "job_field" USING ("field"::"job_field");
ALTER TABLE "job_offer" ALTER COLUMN "workMode" TYPE "work_mode" USING ("workMode"::"work_mode");

-- AlterTable: location.category (String -> LocationCategory) and addressZip (Int -> String)
ALTER TABLE "location" ALTER COLUMN "category" TYPE "location_category" USING ("category"::"location_category");
ALTER TABLE "location" ALTER COLUMN "addressZip" SET DATA TYPE TEXT USING ("addressZip"::TEXT);

-- AlterTable: mensa_meal price columns (Float -> Decimal(6,2))
ALTER TABLE "mensa_meal" ALTER COLUMN "priceStudents" SET DATA TYPE DECIMAL(6,2),
ALTER COLUMN "priceStaff" SET DATA TYPE DECIMAL(6,2),
ALTER COLUMN "priceOther" SET DATA TYPE DECIMAL(6,2);

-- AlterTable: report.reason/reviewStatus (String -> enums), preserving existing data
ALTER TABLE "report" ALTER COLUMN "reviewStatus" DROP DEFAULT;
ALTER TABLE "report" ALTER COLUMN "reason" TYPE "report_reason" USING ("reason"::"report_reason");
ALTER TABLE "report" ALTER COLUMN "reviewStatus" TYPE "report_review_status" USING ("reviewStatus"::"report_review_status");
ALTER TABLE "report" ALTER COLUMN "reviewStatus" SET DEFAULT 'open';

-- NOTE: no CreateIndex here — ALTER COLUMN TYPE preserves the existing
-- job_offer_onlineStatus_idx / location_category_idx indexes in place.
