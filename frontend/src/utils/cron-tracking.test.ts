import { beforeEach, describe, expect, it, vi } from "vitest"
import { runTrackedCronJob } from "./cron-tracking"

const mockCreate = vi.hoisted(() => vi.fn())

vi.mock("./prisma", () => ({
  default: {
    cronJobRun: { create: mockCreate },
  },
}))

beforeEach(() => {
  mockCreate.mockReset()
  mockCreate.mockResolvedValue({})
})

describe("runTrackedCronJob", () => {
  it("records a success run when the job resolves", async () => {
    const outcome = await runTrackedCronJob("mensa-sync", async () => "ok")

    expect(outcome).toEqual({ status: "success" })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobName: "mensa-sync", status: "success", error: null }),
      })
    )
  })

  it("records an error run and does not throw when the job rejects", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const outcome = await runTrackedCronJob("event-sync", async () => {
      throw new Error("boom")
    })

    expect(outcome).toEqual({ status: "error", error: "boom" })
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ jobName: "event-sync", status: "error", error: "boom" }),
      })
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error running scheduled event-sync:",
      expect.any(Error)
    )
  })

  it("does not throw if writing the run to the database fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db down"))

    await expect(runTrackedCronJob("job-offer-sync", async () => "ok")).resolves.toEqual({
      status: "success",
    })

    expect(consoleSpy).toHaveBeenCalledWith("Failed to record cron job run", expect.any(Error))
  })
})
