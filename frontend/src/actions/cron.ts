import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { canViewSystemStatus } from "@/utils/authz"
import { runTrackedCronJob, type CronJobKey } from "@/utils/cron-tracking"
import { syncMensaMeals } from "@/utils/mensa-sync"
import { syncUnivisEvents } from "@/utils/event-sync"
import { syncJobOffers } from "@/utils/job-offer-sync"

const JOB_RUNNERS: Record<CronJobKey, () => Promise<unknown>> = {
  "mensa-sync": syncMensaMeals,
  "event-sync": syncUnivisEvents,
  "job-offer-sync": syncJobOffers,
}

export const cron = {
  run: defineAction({
    accept: "form",
    input: z.object({ key: z.enum(["mensa-sync", "event-sync", "job-offer-sync"]) }),
    handler: async ({ key }, context) => {
      if (!context.locals.user) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
      }
      if (!(await canViewSystemStatus(context.locals.user.role))) {
        throw new ActionError({ code: "FORBIDDEN", message: "Keine Berechtigung." })
      }

      const outcome = await runTrackedCronJob(key, JOB_RUNNERS[key])
      if (outcome.status === "error") {
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: outcome.error })
      }

      return {}
    },
  }),
}
