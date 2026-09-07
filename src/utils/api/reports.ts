import prisma from "../prisma"
import { apiResult, type ApiResult } from "./types"
import { ReportReason } from "@/generated/prisma/enums"
import type { ReportReviewStatus } from "@/generated/prisma/enums"

export const REPORT_REASONS = Object.values(ReportReason)

/** Open reports against one target before it is flagged as repeatedly reported. */
export const REPORT_WARNING_THRESHOLD = 3

export type { ReportReason, ReportReviewStatus }

export type ReportTarget =
  | { type: "event"; title: string; slug: string; published: boolean; rejectionReason?: string }
  | { type: "job"; title: string; slug: string; published: boolean; rejectionReason?: string }

export type Report = {
  id: string
  reason: ReportReason
  details?: string
  reviewStatus: ReportReviewStatus
  createdAt: string
  target: ReportTarget | null
}

type ReportRow = {
  id: string
  reason: ReportReason
  details: string | null
  reviewStatus: ReportReviewStatus
  createdAt: Date
  eventId: string | null
  jobOfferId: string | null
  event: { title: string; slug: string; hidden: boolean; rejectionReason: string | null } | null
  jobOffer: {
    title: string
    slug: string
    onlineStatus: string
    rejectionReason: string | null
  } | null
}

function toReport(row: ReportRow): Report {
  const target: ReportTarget | null = row.event
    ? {
        type: "event",
        title: row.event.title,
        slug: row.event.slug,
        published: !row.event.hidden,
        rejectionReason: row.event.rejectionReason ?? undefined,
      }
    : row.jobOffer
      ? {
          type: "job",
          title: row.jobOffer.title,
          slug: row.jobOffer.slug,
          published: row.jobOffer.onlineStatus === "published",
          rejectionReason: row.jobOffer.rejectionReason ?? undefined,
        }
      : null

  return {
    id: row.id,
    reason: row.reason,
    details: row.details ?? undefined,
    reviewStatus: row.reviewStatus,
    createdAt: row.createdAt.toISOString(),
    target,
  }
}

/**
 * All reports filed against a single event/job, newest first. Grouping lets admins spot
 * targets that keep getting reported instead of triaging one report at a time.
 *
 * `caseStatus` is the case-level verdict, distinct from each report's own `reviewStatus`:
 * a case counts as "resolved" once the target has been taken offline (unpublished/rejected)
 * — regardless of whether the individual reports were ever dismissed — or once every report
 * against a still-published target has been dismissed. Otherwise it's still "open" and needs
 * a decision.
 */
export type ReportGroup = {
  key: string
  target: ReportTarget | null
  reports: Report[]
  totalCount: number
  openCount: number
  dismissedCount: number
  latestCreatedAt: string
  caseStatus: "open" | "resolved"
}

export type ReportsFilter = {
  caseStatus?: "open" | "resolved"
  targetType?: "event" | "job"
  page?: number
  pageSize?: number
}

export type ReportGroupPage = {
  groups: ReportGroup[]
  total: number
  page: number
  pageCount: number
}

const EMPTY_PAGE: ReportGroupPage = { groups: [], total: 0, page: 1, pageCount: 1 }

function groupKey(row: Pick<ReportRow, "eventId" | "jobOfferId" | "id">): string {
  if (row.eventId) return `event:${row.eventId}`
  if (row.jobOfferId) return `job:${row.jobOfferId}`
  return `orphan:${row.id}`
}

function resolveCaseStatus(group: Pick<ReportGroup, "target" | "openCount">): "open" | "resolved" {
  if (!group.target?.published) return "resolved"
  return group.openCount === 0 ? "resolved" : "open"
}

/**
 * Fetch reports for the admin moderation queue, grouped by target and sorted so the
 * most-reported items surface first — those are the ones most likely to need a decision.
 */
export function fetchReportGroupsForAdmin(
  filter: ReportsFilter = {}
): Promise<ApiResult<ReportGroupPage>> {
  const { caseStatus, targetType, page = 1, pageSize = 20 } = filter

  return apiResult("Error fetching reports for admin", EMPTY_PAGE, async () => {
    const rows = await prisma.report.findMany({
      where:
        targetType === "event"
          ? { eventId: { not: null } }
          : targetType === "job"
            ? { jobOfferId: { not: null } }
            : {},
      include: {
        event: { select: { title: true, slug: true, hidden: true, rejectionReason: true } },
        jobOffer: {
          select: { title: true, slug: true, onlineStatus: true, rejectionReason: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const groupsByKey = new Map<string, ReportGroup>()
    for (const row of rows) {
      const report = toReport(row)
      const key = groupKey(row)
      let group = groupsByKey.get(key)
      if (!group) {
        group = {
          key,
          target: report.target,
          reports: [],
          totalCount: 0,
          openCount: 0,
          dismissedCount: 0,
          latestCreatedAt: report.createdAt,
          caseStatus: "open",
        }
        groupsByKey.set(key, group)
      }
      group.reports.push(report)
      group.totalCount += 1
      if (report.reviewStatus === "dismissed") group.dismissedCount += 1
      else group.openCount += 1
    }

    let groups = Array.from(groupsByKey.values())
    for (const group of groups) group.caseStatus = resolveCaseStatus(group)

    if (caseStatus) groups = groups.filter((g) => g.caseStatus === caseStatus)

    groups.sort(
      (a, b) => b.totalCount - a.totalCount || (a.latestCreatedAt < b.latestCreatedAt ? 1 : -1)
    )

    const total = groups.length
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    const paged = groups.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

    return { groups: paged, total, page, pageCount }
  })
}
