import cron from "node-cron"
import { syncJobOffers } from "./job-offer-sync"

const JOB_OFFER_SYNC_SCHEDULE = "0 3 * * *"

if (import.meta.env.PROD) {
  cron.schedule(
    JOB_OFFER_SYNC_SCHEDULE,
    async () => {
      try {
        await syncJobOffers()
      } catch (error) {
        console.error("Error running scheduled job offer sync:", error)
      }
    },
    { timezone: "Europe/Berlin" }
  )
} else if (!import.meta.env.TEST && import.meta.env.LOAD_JOB_OFFERS_ON_STARTUP === "true") {
  console.warn("Loading job offers from feki.de on startup.")
  syncJobOffers().catch((error) => {
    console.error("Error loading job offers on startup:", error)
  })
} else {
  console.warn("Job offer sync cron job is not scheduled in development mode.")
}
