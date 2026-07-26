import cron from "node-cron"
import { syncMensaMeals } from "./mensa-sync"

const MENSA_SYNC_SCHEDULE = "0 5,8,10,11,12,14,16 * * *"

if (import.meta.env.PROD) {
  console.log(`Scheduling Mensa sync cron job with schedule: ${MENSA_SYNC_SCHEDULE}`)
  cron.schedule(
    MENSA_SYNC_SCHEDULE,
    async () => {
      try {
        console.log("Running scheduled Mensa sync...")
        await syncMensaMeals()
      } catch (error) {
        console.error("Error running scheduled Mensa sync:", error)
      }
    },
    { timezone: "Europe/Berlin" }
  )
} else if (!import.meta.env.TEST && import.meta.env.LOAD_MENSA_ON_STARTUP === "true") {
  console.warn("Loading Mensa meals on startup.")
  syncMensaMeals().catch((error) => {
    console.error("Error loading Mensa meals on startup:", error)
  })
} else {
  console.warn("Mensa sync cron job is not scheduled in development mode.")
}
