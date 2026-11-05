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

export async function fetchCronJobStatuses(): Promise<CronJobStatus[]> {
  const rows = await prisma.cronJobRun.findMany({
    orderBy: { startedAt: "desc" },
    distinct: ["jobName"],
  })
  const lastRunByJob = new Map(rows.map((row) => [row.jobName, row]))

  return CRON_JOB_KEYS.map((key) => {
    const row = lastRunByJob.get(key)
    return {
      key,
      schedule: CRON_JOB_DEFINITIONS[key].schedule,
      lastRun: row
        ? {
            status: row.status,
            startedAt: row.startedAt,
            finishedAt: row.finishedAt,
            durationMs: row.durationMs,
            error: row.error,
          }
        : null,
    }
  })
}
