import { JobOnlineStatus } from "@/generated/prisma/enums"
import type { JobType } from "./api/job-offers"
import type { useTranslations } from "@/i18n/translations"

export type JobStatus = JobOnlineStatus

export type AlertVariant = "success" | "error" | "warning" | "neutral" | "info"

export const JOB_STATUS_ALERT_VARIANT: Partial<Record<JobStatus, AlertVariant>> = {
  submitted: "warning",
  expired: "neutral",
  rejected: "error",
  archived: "info",
}

export const JOB_TYPE_BADGE_CLASS: Record<JobType, string> = {
  part_time: "badge-primary",
  internship: "badge-secondary",
  working_student: "badge-info",
  research_assistant: "badge-warning",
  thesis: "badge-accent",
  volunteer: "badge-success",
  other: "badge-ghost",
}

/** Tinted pills: a light background with dark text, so that they don't look like buttons. */
export const JOB_STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  submitted: "badge-soft badge-warning",
  published: "badge-soft badge-success",
  expired: "badge-soft badge-neutral",
  rejected: "badge-soft badge-error",
  archived: "badge-soft badge-info",
}

export function jobStatusLabel(
  t: Pick<ReturnType<typeof useTranslations>, "auth">,
  status: JobStatus
): string {
  const labels: Record<JobStatus, string> = {
    submitted: t.auth.statusSubmitted,
    published: t.auth.statusPublished,
    expired: t.auth.statusExpired,
    rejected: t.auth.statusRejected,
    archived: t.auth.statusArchived,
  }
  return labels[status]
}

/**
 * The statuses each moderation decision applies to. Deciding the same twice would mail the owner
 * twice, and an archived offer is final. An approval starts a new lifetime, thus an expired offer
 * can be published again.
 */
export const MODERATABLE_FROM: Record<"published" | "rejected", JobStatus[]> = {
  published: [JobOnlineStatus.submitted, JobOnlineStatus.rejected, JobOnlineStatus.expired],
  rejected: [JobOnlineStatus.submitted, JobOnlineStatus.published],
}

/** Only listings that are live or still under review can be archived. */
export const ARCHIVABLE_STATUSES: JobStatus[] = [
  JobOnlineStatus.published,
  JobOnlineStatus.submitted,
]

export function canArchiveJob(status: JobStatus): boolean {
  return ARCHIVABLE_STATUSES.includes(status)
}

/** Archiving is final, thus an archived listing can no longer be edited. */
export function canEditJob(status: JobStatus): boolean {
  return status !== "archived"
}
