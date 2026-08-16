import cron from "node-cron"
import { expireJobOffers } from "./job-offer-expiry"
import { runTrackedCronJob, CRON_JOB_DEFINITIONS } from "./cron-tracking"

const JOB_OFFER_EXPIRY_SCHEDULE = CRON_JOB_DEFINITIONS["job-offer-expiry"].schedule

if (import.meta.env.PROD) {
  cron.schedule(
    JOB_OFFER_EXPIRY_SCHEDULE,
    () => runTrackedCronJob("job-offer-expiry", expireJobOffers),
    { timezone: "Europe/Berlin" }
  )
} else {
  console.warn("Job offer expiry cron job is not scheduled in development mode.")
}
