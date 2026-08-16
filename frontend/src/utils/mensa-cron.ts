import cron from "node-cron"
import { syncMensaMeals } from "./mensa-sync"
import { runTrackedCronJob, CRON_JOB_DEFINITIONS } from "./cron-tracking"

const MENSA_SYNC_SCHEDULE = CRON_JOB_DEFINITIONS["mensa-sync"].schedule

if (import.meta.env.PROD) {
  console.log(`Scheduling Mensa sync cron job with schedule: ${MENSA_SYNC_SCHEDULE}`)
  cron.schedule(
    MENSA_SYNC_SCHEDULE,
    () => {
      console.log("Running scheduled Mensa sync...")
      return runTrackedCronJob("mensa-sync", syncMensaMeals)
    },
    { timezone: "Europe/Berlin" }
  )
} else if (!import.meta.env.TEST && import.meta.env.LOAD_MENSA_ON_STARTUP === "true") {
  console.warn("Loading Mensa meals on startup.")
  runTrackedCronJob("mensa-sync", syncMensaMeals)
} else {
  console.warn("Mensa sync cron job is not scheduled in development mode.")
}
