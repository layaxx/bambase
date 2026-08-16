import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCalendar = vi.hoisted(() => vi.fn())
vi.mock("univis-api", () => ({
  UnivISClient: vi.fn().mockImplementation(() => ({ getCalendar: mockGetCalendar })),
}))

const mockFindMany = vi.hoisted(() => vi.fn())
const mockDeleteMany = vi.hoisted(() => vi.fn())
vi.mock("./prisma", () => ({
  default: {
    event: { findMany: mockFindMany, deleteMany: mockDeleteMany },
  },
}))

import { syncUnivisEvents } from "./event-sync"

beforeEach(() => {
  mockGetCalendar.mockReset()
  mockFindMany.mockReset().mockResolvedValue([])
  mockDeleteMany.mockReset().mockResolvedValue(undefined)
})

describe("syncUnivisEvents", () => {
  it("throws when fetching the UniVis calendar fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockGetCalendar.mockRejectedValue(new Error("timeout"))

    await expect(syncUnivisEvents()).rejects.toThrow(/timeout/)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("timeout"))
  })

  it("resolves without throwing when the fetch succeeds", async () => {
    mockGetCalendar.mockResolvedValue([])

    await expect(syncUnivisEvents()).resolves.toBeUndefined()
  })
})
