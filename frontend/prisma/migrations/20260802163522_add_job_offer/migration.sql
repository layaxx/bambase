-- CreateTable
CREATE TABLE "job_offer" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "onlineStatus" TEXT NOT NULL DEFAULT 'submitted',
    "workingHours" INTEGER NOT NULL,
    "externalUrl" TEXT,
    "jobType" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "workMode" TEXT NOT NULL,
    "contactName" TEXT,
    "contactMail" TEXT,
    "contactPhone" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_offer_slug_key" ON "job_offer"("slug");

-- CreateIndex
CREATE INDEX "job_offer_onlineStatus_idx" ON "job_offer"("onlineStatus");

-- AddForeignKey
ALTER TABLE "job_offer" ADD CONSTRAINT "job_offer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report" ADD CONSTRAINT "report_jobOfferId_fkey" FOREIGN KEY ("jobOfferId") REFERENCES "job_offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
