-- CreateEnum
CREATE TYPE "cron_job_status" AS ENUM ('success', 'error');

-- CreateTable
CREATE TABLE "cron_job_run" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "cron_job_status" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cron_job_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_job_run_jobName_startedAt_idx" ON "cron_job_run"("jobName", "startedAt");
