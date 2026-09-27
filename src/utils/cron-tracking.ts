import prisma from "./prisma"
import { errorMessage } from "./error-message"
import { baseLogger } from "./logger"

export const CRON_JOB_DEFINITIONS = {
  "mensa-sync": { schedule: "0 5,8,10,11,12,14,16 * * *" },
  "event-sync": { schedule: "0 2 * * *" },
  "job-offer-sync": { schedule: "0 3 * * *" },
  "job-offer-expiry": { schedule: "0 1 * * *" },
} as const

export type CronJobKey = keyof typeof CRON_JOB_DEFINITIONS

export const CRON_JOB_KEYS = Object.keys(CRON_JOB_DEFINITIONS) as CronJobKey[]

export type CronJobRunOutcome = { status: "success" } | { status: "error"; error: string }

async function recordCronRun(
  jobName: CronJobKey,
  status: "success" | "error",
  startedAt: Date,
  error?: unknown
) {
  const finishedAt = new Date()
  try {
    await prisma.cronJobRun.create({
      data: {
        jobName,
        status,
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error: status === "error" ? errorMessage(error).slice(0, 1000) : null,
      },
    })
  } catch (dbError) {
    baseLogger.error({ err: dbError, jobName }, "cron run record failed")
  }
}

/** Runs a cron job and records the result for the admin cron status page. Never throws. */
export async function runTrackedCronJob(
  jobName: CronJobKey,
  fn: () => Promise<unknown>
): Promise<CronJobRunOutcome> {
  const startedAt = new Date()
  try {
    await fn()
    await recordCronRun(jobName, "success", startedAt)
    return { status: "success" }
  } catch (error) {
    baseLogger.error({ err: error, jobName }, "cron job failed")
    await recordCronRun(jobName, "error", startedAt, error)
    return { status: "error", error: errorMessage(error).slice(0, 1000) }
  }
}
