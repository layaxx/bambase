import { expireJobOffers } from "./job-offer-expiry"
import { registerCronJob } from "./register-cron-job"

registerCronJob("job-offer-expiry", expireJobOffers)
