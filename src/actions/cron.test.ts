import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:actions", () => ({
  defineAction: ({ handler }: never) => handler,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock("astro/zod", async () => await import("zod"))

const mockCanViewSystemStatus = vi.hoisted(() => vi.fn())
vi.mock("@/utils/authz", () => ({
  canViewSystemStatus: mockCanViewSystemStatus,
}))

const mockRunTrackedCronJob = vi.hoisted(() => vi.fn())
vi.mock("@/utils/cron-tracking", () => ({
  runTrackedCronJob: mockRunTrackedCronJob,
  CRON_JOB_KEYS: ["mensa-sync", "event-sync", "job-offer-sync", "job-offer-expiry"],
}))

const mockSyncMensaMeals = vi.hoisted(() => vi.fn())
vi.mock("@/utils/mensa-sync", () => ({ syncMensaMeals: mockSyncMensaMeals }))
const mockSyncUnivisEvents = vi.hoisted(() => vi.fn())
vi.mock("@/utils/event-sync", () => ({ syncUnivisEvents: mockSyncUnivisEvents }))
const mockSyncJobOffers = vi.hoisted(() => vi.fn())
vi.mock("@/utils/job-offer-sync", () => ({ syncJobOffers: mockSyncJobOffers }))
const mockExpireJobOffers = vi.hoisted(() => vi.fn())
vi.mock("@/utils/job-offer-expiry", () => ({ expireJobOffers: mockExpireJobOffers }))

import { cron } from "./cron"

function makeContext(userId?: string, role: string | null = null) {
  return { locals: { user: userId ? { id: userId, role } : null } }
}

beforeEach(() => {
  mockCanViewSystemStatus.mockReset()
  mockRunTrackedCronJob.mockReset()
})

describe("cron.run", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      cron.run(
        { key: "mensa-sync" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot view system status", async () => {
    mockCanViewSystemStatus.mockResolvedValue(false)

    await expect(
      cron.run(
        { key: "mensa-sync" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("runs the requested job and returns successfully", async () => {
    mockCanViewSystemStatus.mockResolvedValue(true)
    mockRunTrackedCronJob.mockResolvedValue({ status: "success" })

    const result = await cron.run(
      { key: "event-sync" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockRunTrackedCronJob).toHaveBeenCalledWith("event-sync", mockSyncUnivisEvents)
    expect(result).toEqual({})
  })

  it("runs the job offer expiry job", async () => {
    mockCanViewSystemStatus.mockResolvedValue(true)
    mockRunTrackedCronJob.mockResolvedValue({ status: "success" })

    const result = await cron.run(
      { key: "job-offer-expiry" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockRunTrackedCronJob).toHaveBeenCalledWith("job-offer-expiry", mockExpireJobOffers)
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR with the job's error message when the run fails", async () => {
    mockCanViewSystemStatus.mockResolvedValue(true)
    mockRunTrackedCronJob.mockResolvedValue({ status: "error", error: "network error" })

    await expect(
      cron.run(
        { key: "job-offer-sync" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "network error" })
  })
})
