import cron from "node-cron"
import { runTrackedCronJob, CRON_JOB_DEFINITIONS, type CronJobKey } from "./cron-tracking"

type RegisterCronJobOptions = {
  /** If this variable is "true", the job runs once at startup outside production and tests. */
  startupEnvVar?: string
  startupMessage?: string
}

/**
 * Schedules `fn` as a tracked cron job in production. Outside production the job runs once at
 * startup if `startupEnvVar` is "true". If it is not "true", the function only logs that it did
 * not schedule the job.
 */
export function registerCronJob(
  key: CronJobKey,
  fn: () => Promise<unknown>,
  { startupEnvVar, startupMessage }: RegisterCronJobOptions = {}
): void {
  const schedule = CRON_JOB_DEFINITIONS[key].schedule

  if (import.meta.env.PROD) {
    cron.schedule(schedule, () => runTrackedCronJob(key, fn), { timezone: "Europe/Berlin" })
  } else if (!import.meta.env.TEST && startupEnvVar && import.meta.env[startupEnvVar] === "true") {
    console.warn(startupMessage ?? `Running ${key} on startup.`)
    runTrackedCronJob(key, fn)
  } else {
    console.warn(`${key} cron job is not scheduled in development mode.`)
  }
}
