import cron from "node-cron"
import { syncJobOffers } from "./job-offer-sync"
import { runTrackedCronJob, CRON_JOB_DEFINITIONS } from "./cron-tracking"

const JOB_OFFER_SYNC_SCHEDULE = CRON_JOB_DEFINITIONS["job-offer-sync"].schedule

if (import.meta.env.PROD) {
  cron.schedule(JOB_OFFER_SYNC_SCHEDULE, () => runTrackedCronJob("job-offer-sync", syncJobOffers), {
    timezone: "Europe/Berlin",
  })
} else if (!import.meta.env.TEST && import.meta.env.LOAD_JOB_OFFERS_ON_STARTUP === "true") {
  console.warn("Loading job offers from feki.de on startup.")
  runTrackedCronJob("job-offer-sync", syncJobOffers)
} else {
  console.warn("Job offer sync cron job is not scheduled in development mode.")
}
