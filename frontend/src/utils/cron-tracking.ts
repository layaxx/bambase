import prisma from "./prisma"

export const CRON_JOB_DEFINITIONS = {
  "mensa-sync": { schedule: "0 5,8,10,11,12,14,16 * * *" },
  "event-sync": { schedule: "0 2 * * *" },
  "job-offer-sync": { schedule: "0 3 * * *" },
} as const

export type CronJobKey = keyof typeof CRON_JOB_DEFINITIONS

export const CRON_JOB_KEYS = Object.keys(CRON_JOB_DEFINITIONS) as CronJobKey[]

export type CronJobRunOutcome = { status: "success" } | { status: "error"; error: string }

function formatError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000)
}

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
        error: status === "error" ? formatError(error) : null,
      },
    })
  } catch (dbError) {
    console.error("Failed to record cron job run", dbError)
  }
}

/** Runs a cron job, recording its outcome for the admin cron status page. Never throws. */
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
    console.error(`Error running scheduled ${jobName}:`, error)
    const message = formatError(error)
    await recordCronRun(jobName, "error", startedAt, error)
    return { status: "error", error: message }
  }
}
