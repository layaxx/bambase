import cron from "node-cron"
import { syncUnivisEvents } from "./event-sync"

const UNIVIS_SYNC_SCHEDULE = "0 2 * * *"

if (import.meta.env.PROD) {
  cron.schedule(
    UNIVIS_SYNC_SCHEDULE,
    async () => {
      try {
        await syncUnivisEvents()
      } catch (error) {
        console.error("Error running scheduled UniVis sync:", error)
      }
    },
    { timezone: "Europe/Berlin" }
  )
} else if (!import.meta.env.TEST && import.meta.env.LOAD_EVENTS_ON_STARTUP === "true") {
  console.warn("Loading UniVis events on startup.")
  syncUnivisEvents().catch((error) => {
    console.error("Error loading UniVis events on startup:", error)
  })
} else {
  console.warn("UniVis sync cron job is not scheduled in development mode.")
}
