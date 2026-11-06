import prisma from "../prisma"
import { CRON_JOB_DEFINITIONS, CRON_JOB_KEYS, type CronJobKey } from "@/utils/cron-tracking"

export interface CronJobLastRun {
  status: "success" | "error"
  startedAt: Date
  finishedAt: Date
  durationMs: number
  error: string | null
}

export interface CronJobStatus {
  key: CronJobKey
  schedule: string
  lastRun: CronJobLastRun | null
}

/** One indexed lookup per job, so the cost stays flat however much run history piles up. */
export async function fetchCronJobStatuses(): Promise<CronJobStatus[]> {
  return Promise.all(
    CRON_JOB_KEYS.map(async (key) => {
      const row = await prisma.cronJobRun.findFirst({
        where: { jobName: key },
        orderBy: { startedAt: "desc" },
        select: { status: true, startedAt: true, finishedAt: true, durationMs: true, error: true },
      })
      return { key, schedule: CRON_JOB_DEFINITIONS[key].schedule, lastRun: row }
    })
  )
}
