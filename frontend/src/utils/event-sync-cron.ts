import { syncUnivisEvents } from "./event-sync"
import { registerCronJob } from "./register-cron-job"

registerCronJob("event-sync", syncUnivisEvents, {
  startupEnvVar: "LOAD_EVENTS_ON_STARTUP",
  startupMessage: "Loading UniVis events on startup.",
})
