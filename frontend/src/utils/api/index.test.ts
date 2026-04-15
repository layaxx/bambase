import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the client module to avoid real network setup during module init
vi.mock("./client", () => ({
  client: { collection: vi.fn() },
  strapiUrl: "http://localhost:1337",
}))

describe("REPORT_WARNING_THRESHOLD", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("defaults to 3 when the env var is not set", async () => {
    const { REPORT_WARNING_THRESHOLD } = await import("./index")
    expect(REPORT_WARNING_THRESHOLD).toBe(3)
  })

  it("parses a valid integer from the env var", async () => {
    vi.stubEnv("REPORT_WARNING_THRESHOLD", "5")
    const { REPORT_WARNING_THRESHOLD } = await import("./index")
    expect(REPORT_WARNING_THRESHOLD).toBe(5)
  })

  it("falls back to 3 when the env var is not a valid number", async () => {
    vi.stubEnv("REPORT_WARNING_THRESHOLD", "not-a-number")
    const { REPORT_WARNING_THRESHOLD } = await import("./index")
    expect(REPORT_WARNING_THRESHOLD).toBe(3)
  })

  it("truncates a decimal string to an integer", async () => {
    vi.stubEnv("REPORT_WARNING_THRESHOLD", "2.9")
    const { REPORT_WARNING_THRESHOLD } = await import("./index")
    expect(REPORT_WARNING_THRESHOLD).toBe(2)
  })
})
