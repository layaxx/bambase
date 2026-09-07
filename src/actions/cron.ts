import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { canViewSystemStatus } from "@/utils/authz"
import { requirePermission } from "@/utils/action-guards"
import { runTrackedCronJob, CRON_JOB_KEYS, type CronJobKey } from "@/utils/cron-tracking"
import { syncMensaMeals } from "@/utils/mensa-sync"
import { syncUnivisEvents } from "@/utils/event-sync"
import { syncJobOffers } from "@/utils/job-offer-sync"
import { expireJobOffers } from "@/utils/job-offer-expiry"

const JOB_RUNNERS: Record<CronJobKey, () => Promise<unknown>> = {
  "mensa-sync": syncMensaMeals,
  "event-sync": syncUnivisEvents,
  "job-offer-sync": syncJobOffers,
  "job-offer-expiry": expireJobOffers,
}

export const cron = {
  run: defineAction({
    accept: "form",
    input: z.object({ key: z.enum(CRON_JOB_KEYS) }),
    handler: async ({ key }, context) => {
      await requirePermission(context, canViewSystemStatus)

      const outcome = await runTrackedCronJob(key, JOB_RUNNERS[key])
      if (outcome.status === "error") {
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: outcome.error })
      }

      return {}
    },
  }),
}
