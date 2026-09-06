import { syncMensaMeals } from "./mensa-sync"
import { registerCronJob } from "./register-cron-job"

registerCronJob("mensa-sync", syncMensaMeals, {
  startupEnvVar: "LOAD_MENSA_ON_STARTUP",
  startupMessage: "Loading Mensa meals on startup.",
})
