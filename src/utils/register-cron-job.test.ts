import { beforeEach, describe, expect, it, vi } from "vitest"

const mockSchedule = vi.hoisted(() => vi.fn())
vi.mock("node-cron", () => ({ default: { schedule: mockSchedule } }))

const mockRunTrackedCronJob = vi.hoisted(() => vi.fn())
vi.mock("./cron-tracking", () => ({
  runTrackedCronJob: mockRunTrackedCronJob,
  CRON_JOB_DEFINITIONS: { "mensa-sync": { schedule: "0 5 * * *" } },
}))

import { registerCronJob } from "./register-cron-job"

beforeEach(() => {
  mockSchedule.mockReset()
  mockRunTrackedCronJob.mockReset().mockResolvedValue({ status: "success" })
  vi.unstubAllEnvs()
})

describe("registerCronJob", () => {
  it("schedules the job with node-cron in production, running it via runTrackedCronJob", () => {
    vi.stubEnv("PROD", true)
    const fn = vi.fn()

    registerCronJob("mensa-sync", fn)

    expect(mockSchedule).toHaveBeenCalledWith("0 5 * * *", expect.any(Function), {
      timezone: "Europe/Berlin",
    })
    expect(mockRunTrackedCronJob).not.toHaveBeenCalled()

    const scheduledCallback = mockSchedule.mock.calls[0][1]
    scheduledCallback()
    expect(mockRunTrackedCronJob).toHaveBeenCalledWith("mensa-sync", fn)
  })

  it("runs the job once at startup outside production when the startup env var is 'true'", () => {
    vi.stubEnv("PROD", false)
    vi.stubEnv("TEST", "")
    vi.stubEnv("LOAD_MENSA_ON_STARTUP", "true")
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const fn = vi.fn()

    registerCronJob("mensa-sync", fn, {
      startupEnvVar: "LOAD_MENSA_ON_STARTUP",
      startupMessage: "Loading on startup.",
    })

    expect(mockSchedule).not.toHaveBeenCalled()
    expect(mockRunTrackedCronJob).toHaveBeenCalledWith("mensa-sync", fn)
    expect(consoleSpy).toHaveBeenCalledWith("Loading on startup.")
  })

  it("falls back to a default startup message when none is given", () => {
    vi.stubEnv("PROD", false)
    vi.stubEnv("TEST", "")
    vi.stubEnv("LOAD_MENSA_ON_STARTUP", "true")
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    registerCronJob("mensa-sync", vi.fn(), { startupEnvVar: "LOAD_MENSA_ON_STARTUP" })

    expect(consoleSpy).toHaveBeenCalledWith("Running mensa-sync on startup.")
  })

  it("does not run at startup while under test even if the startup env var is 'true'", () => {
    vi.stubEnv("PROD", false)
    vi.stubEnv("TEST", "true")
    vi.stubEnv("LOAD_MENSA_ON_STARTUP", "true")

    registerCronJob("mensa-sync", vi.fn(), { startupEnvVar: "LOAD_MENSA_ON_STARTUP" })

    expect(mockSchedule).not.toHaveBeenCalled()
    expect(mockRunTrackedCronJob).not.toHaveBeenCalled()
  })

  it("logs a skip notice outside production when no startup env var is configured", () => {
    vi.stubEnv("PROD", false)
    vi.stubEnv("TEST", "")
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    registerCronJob("mensa-sync", vi.fn())

    expect(mockSchedule).not.toHaveBeenCalled()
    expect(mockRunTrackedCronJob).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      "mensa-sync cron job is not scheduled in development mode."
    )
  })

  it("logs a skip notice outside production when the startup env var is not 'true'", () => {
    vi.stubEnv("PROD", false)
    vi.stubEnv("TEST", "")
    vi.stubEnv("LOAD_MENSA_ON_STARTUP", "false")
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    registerCronJob("mensa-sync", vi.fn(), { startupEnvVar: "LOAD_MENSA_ON_STARTUP" })

    expect(mockRunTrackedCronJob).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      "mensa-sync cron job is not scheduled in development mode."
    )
  })
})
