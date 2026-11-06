import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCronJobStatuses } from "./cron-jobs"

const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    cronJobRun: { findFirst: mockFindFirst },
  },
}))

beforeEach(() => {
  mockFindFirst.mockReset()
})

describe("fetchCronJobStatuses", () => {
  it("returns every registered job, with null lastRun for jobs that never ran", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchCronJobStatuses()
    expect(result).toEqual([
      { key: "mensa-sync", schedule: "0 5,8,10,11,12,14,16 * * *", lastRun: null },
      { key: "event-sync", schedule: "0 2 * * *", lastRun: null },
      { key: "job-offer-expiry", schedule: "0 1 * * *", lastRun: null },
    ])
  })

  it("attaches the most recent run to its matching job", async () => {
    const startedAt = new Date("2026-08-16T02:00:00Z")
    const finishedAt = new Date("2026-08-16T02:00:05Z")
    const run = { status: "error", startedAt, finishedAt, durationMs: 5000, error: "network error" }
    mockFindFirst.mockImplementation(async ({ where }) =>
      where.jobName === "event-sync" ? run : null
    )

    const result = await fetchCronJobStatuses()

    expect(result.find((job) => job.key === "event-sync")?.lastRun).toEqual({
      status: "error",
      startedAt,
      finishedAt,
      durationMs: 5000,
      error: "network error",
    })
    expect(result.find((job) => job.key === "mensa-sync")?.lastRun).toBeNull()
  })

  it("reads only the latest run of each job, never the whole history", async () => {
    mockFindFirst.mockResolvedValue(null)

    await fetchCronJobStatuses()

    expect(mockFindFirst).toHaveBeenCalledTimes(3)
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { jobName: "mensa-sync" }, orderBy: { startedAt: "desc" } })
    )
  })
})
