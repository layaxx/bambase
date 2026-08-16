import cron from "node-cron"
import { syncUnivisEvents } from "./event-sync"
import { runTrackedCronJob, CRON_JOB_DEFINITIONS } from "./cron-tracking"

const UNIVIS_SYNC_SCHEDULE = CRON_JOB_DEFINITIONS["event-sync"].schedule

if (import.meta.env.PROD) {
  cron.schedule(UNIVIS_SYNC_SCHEDULE, () => runTrackedCronJob("event-sync", syncUnivisEvents), {
    timezone: "Europe/Berlin",
  })
} else if (!import.meta.env.TEST && import.meta.env.LOAD_EVENTS_ON_STARTUP === "true") {
  console.warn("Loading UniVis events on startup.")
  runTrackedCronJob("event-sync", syncUnivisEvents)
} else {
  console.warn("UniVis sync cron job is not scheduled in development mode.")
}
