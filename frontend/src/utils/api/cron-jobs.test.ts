import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCronJobStatuses } from "./cron-jobs"

const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    cronJobRun: { findMany: mockFindMany },
  },
}))

beforeEach(() => {
  mockFindMany.mockReset()
})

describe("fetchCronJobStatuses", () => {
  it("returns every registered job, with null lastRun for jobs that never ran", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await fetchCronJobStatuses()

    expect(result.apiDown).toBe(false)
    expect(result.data).toEqual([
      { key: "mensa-sync", schedule: "0 5,8,10,11,12,14,16 * * *", lastRun: null },
      { key: "event-sync", schedule: "0 2 * * *", lastRun: null },
      { key: "job-offer-sync", schedule: "0 3 * * *", lastRun: null },
      { key: "job-offer-expiry", schedule: "0 1 * * *", lastRun: null },
    ])
  })

  it("attaches the most recent run to its matching job", async () => {
    const startedAt = new Date("2026-08-16T02:00:00Z")
    const finishedAt = new Date("2026-08-16T02:00:05Z")
    mockFindMany.mockResolvedValue([
      {
        jobName: "event-sync",
        status: "error",
        startedAt,
        finishedAt,
        durationMs: 5000,
        error: "network error",
      },
    ])

    const result = await fetchCronJobStatuses()

    expect(result.data.find((job) => job.key === "event-sync")?.lastRun).toEqual({
      status: "error",
      startedAt,
      finishedAt,
      durationMs: 5000,
      error: "network error",
    })
    expect(result.data.find((job) => job.key === "mensa-sync")?.lastRun).toBeNull()
  })

  it("requests only the most recent run per job", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchCronJobStatuses()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { startedAt: "desc" },
        distinct: ["jobName"],
      })
    )
  })

  it("logs an error and returns an empty list when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("db error"))

    const result = await fetchCronJobStatuses()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching cron job statuses", expect.any(Error))
  })
})
