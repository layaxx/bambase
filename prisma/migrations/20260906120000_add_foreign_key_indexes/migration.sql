-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "event_ownerId_idx" ON "event"("ownerId");

-- CreateIndex
CREATE INDEX "event_mapLocationId_idx" ON "event"("mapLocationId");

-- CreateIndex
CREATE INDEX "job_offer_ownerId_idx" ON "job_offer"("ownerId");

-- CreateIndex
CREATE INDEX "report_eventId_idx" ON "report"("eventId");

-- CreateIndex
CREATE INDEX "report_jobOfferId_idx" ON "report"("jobOfferId");

-- CreateIndex
CREATE INDEX "report_reviewStatus_idx" ON "report"("reviewStatus");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

