import type { APIRoute } from "astro"
import prisma from "@/utils/prisma"
import { fetchCronJobStatuses } from "@/utils/api/cron-jobs"
import { canViewSystemStatus } from "@/utils/authz"
import { getLogger } from "@/utils/logger"
import { checkMailgun } from "@/utils/mail"

// Every cron job runs at least daily, so a last run older than this means the scheduler stalled.
const CRON_STALE_MS = 26 * 60 * 60 * 1000

const ageSeconds = (date: Date | undefined) =>
  date ? Math.round((Date.now() - date.getTime()) / 1000) : null

function httpStatus(status: "ok" | "degraded" | "down"): number {
  switch (status) {
    case "ok":
      return 200
    case "degraded":
      return 207
    case "down":
      return 503
    default:
      return 500
  }
}

async function collectDetails() {
  const [unreviewedJobs, openReports, cronJobs] = await Promise.all([
    prisma.jobOffer.count({ where: { onlineStatus: "submitted" } }),
    prisma.report.count({ where: { reviewStatus: "open" } }),

    fetchCronJobStatuses(),
  ])

  return {
    moderation: {
      unreviewedJobOffers: unreviewedJobs,
      openReports,
    },
    cron: cronJobs.map(({ key, lastRun }) => ({
      job: key,
      lastStatus: lastRun?.status ?? null,
      lastRunAgeSeconds: ageSeconds(lastRun?.startedAt),
      healthy:
        lastRun?.status === "success" && Date.now() - lastRun.startedAt.getTime() < CRON_STALE_MS,
    })),
  }
}

/**
 * Anonymous callers (uptime monitors, Docker healthcheck) get only the status and the HTTP code:
 * 200 for ok, 207 for degraded, 503 when the database is
 * down. Users with system:view also get the moderation backlog and cron state.
 */
export const GET: APIRoute = async ({ locals }) => {
  const startedAt = performance.now()
  let dbOk = true
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (err) {
    dbOk = false
    getLogger().error({ err }, "health check: database unreachable")
  }
  const dbLatencyMs = Math.round(performance.now() - startedAt)

  const mail = await checkMailgun()

  // Collected for everyone so anonymous and admin callers see the same status; only shown to admins.
  const details = dbOk
    ? await collectDetails().catch((err) => {
        getLogger().error({ err }, "health check: collecting details failed")
        return null
      })
    : undefined
  const showDetails = dbOk && (await canViewSystemStatus(locals.user?.role).catch(() => false))

  const degraded = mail.ok !== true || details === null || details?.cron.some((job) => !job.healthy)
  const status = !dbOk ? "down" : degraded ? "degraded" : "ok"

  const body = {
    status,
    ...(showDetails && {
      uptimeSeconds: Math.round(process.uptime()),
      checks: {
        database: { ok: dbOk, latencyMs: dbLatencyMs },
        mail,
      },
      ...details,
    }),
  }

  return new Response(JSON.stringify(body), {
    status: httpStatus(status),
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  })
}
