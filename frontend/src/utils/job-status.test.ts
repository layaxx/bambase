import { describe, expect, it } from "vitest"
import { JOB_STATUS_ALERT_CLASS, JOB_STATUS_BADGE_CLASS, JOB_TYPE_BADGE_CLASS } from "./job-status"
import { JOB_TYPES } from "./api/job-offers"

// All valid online_status values for a job offer
const ALL_STATUSES = ["submitted", "published", "expired", "rejected", "archived"] as const

describe("JOB_STATUS_ALERT_CLASS", () => {
  it("covers all non-published statuses", () => {
    const nonPublished = ALL_STATUSES.filter((s) => s !== "published")
    for (const status of nonPublished) {
      expect(JOB_STATUS_ALERT_CLASS[status]).toBeDefined()
    }
  })

  it("maps submitted to alert-warning", () => {
    expect(JOB_STATUS_ALERT_CLASS.submitted).toBe("alert-warning")
  })

  it("maps expired to alert-neutral", () => {
    expect(JOB_STATUS_ALERT_CLASS.expired).toBe("alert-neutral")
  })

  it("maps rejected to alert-error", () => {
    expect(JOB_STATUS_ALERT_CLASS.rejected).toBe("alert-error")
  })

  it("maps archived to alert-info", () => {
    expect(JOB_STATUS_ALERT_CLASS.archived).toBe("alert-info")
  })

  it("does not include published (published jobs show no alert)", () => {
    expect(JOB_STATUS_ALERT_CLASS.published).toBeUndefined()
  })

  it("returns undefined for an unknown status (caller should fall back)", () => {
    // @ts-expect-error: We're intentionally testing an invalid status here
    expect(JOB_STATUS_ALERT_CLASS["unknown"]).toBeUndefined()
  })
})

describe("JOB_STATUS_BADGE_CLASS", () => {
  it("covers all statuses", () => {
    for (const status of ALL_STATUSES) {
      expect(JOB_STATUS_BADGE_CLASS[status]).toBeDefined()
    }
  })

  it("maps submitted to badge-warning", () => {
    expect(JOB_STATUS_BADGE_CLASS.submitted).toBe("badge-warning")
  })

  it("maps published to badge-success", () => {
    expect(JOB_STATUS_BADGE_CLASS.published).toBe("badge-success")
  })

  it("maps expired to badge-neutral", () => {
    expect(JOB_STATUS_BADGE_CLASS.expired).toBe("badge-neutral")
  })

  it("maps rejected to badge-error", () => {
    expect(JOB_STATUS_BADGE_CLASS.rejected).toBe("badge-error")
  })

  it("maps archived to badge-info", () => {
    expect(JOB_STATUS_BADGE_CLASS.archived).toBe("badge-info")
  })

  it("returns undefined for an unknown status (caller should fall back)", () => {
    // @ts-expect-error: We're intentionally testing an invalid status here
    expect(JOB_STATUS_BADGE_CLASS["unknown"]).toBeUndefined()
  })
})

describe("JOB_TYPE_BADGE_CLASS", () => {
  it("covers all job types", () => {
    for (const type of JOB_TYPES) {
      expect(JOB_TYPE_BADGE_CLASS[type]).toBeDefined()
    }
  })

  it("maps part_time to badge-primary", () => {
    expect(JOB_TYPE_BADGE_CLASS.part_time).toBe("badge-primary")
  })

  it("maps internship to badge-secondary", () => {
    expect(JOB_TYPE_BADGE_CLASS.internship).toBe("badge-secondary")
  })

  it("maps working_student to badge-info", () => {
    expect(JOB_TYPE_BADGE_CLASS.working_student).toBe("badge-info")
  })

  it("maps research_assistant to badge-warning", () => {
    expect(JOB_TYPE_BADGE_CLASS.research_assistant).toBe("badge-warning")
  })

  it("maps thesis to badge-accent", () => {
    expect(JOB_TYPE_BADGE_CLASS.thesis).toBe("badge-accent")
  })

  it("maps volunteer to badge-success", () => {
    expect(JOB_TYPE_BADGE_CLASS.volunteer).toBe("badge-success")
  })

  it("maps other to badge-ghost", () => {
    expect(JOB_TYPE_BADGE_CLASS.other).toBe("badge-ghost")
  })
})
