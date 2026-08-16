import { syncJobOffers } from "./job-offer-sync"
import { registerCronJob } from "./register-cron-job"

registerCronJob("job-offer-sync", syncJobOffers, {
  startupEnvVar: "LOAD_JOB_OFFERS_ON_STARTUP",
  startupMessage: "Loading job offers from feki.de on startup.",
})
