import type { JobType } from "./api/job-offers"

export type JobStatus = "submitted" | "published" | "expired" | "rejected" | "archived"

export const JOB_TYPE_BADGE_CLASS: Record<JobType, string> = {
  part_time: "badge-primary",
  internship: "badge-secondary",
  working_student: "badge-info",
  research_assistant: "badge-warning",
  thesis: "badge-accent",
  volunteer: "badge-success",
  other: "badge-ghost",
}

export const JOB_STATUS_ALERT_CLASS: Partial<Record<JobStatus, string>> = {
  submitted: "alert-warning",
  expired: "alert-neutral",
  rejected: "alert-error",
  archived: "alert-info",
}

export const JOB_STATUS_BADGE_CLASS: Record<JobStatus, string> = {
  submitted: "badge-warning",
  published: "badge-success",
  expired: "badge-neutral",
  rejected: "badge-error",
  archived: "badge-info",
}
