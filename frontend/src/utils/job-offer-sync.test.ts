import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
vi.mock("./prisma", () => ({
  default: {
    jobOffer: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      create: mockCreate,
    },
  },
}))

import { syncJobOffers } from "./job-offer-sync"

const ORIGINAL_ENV = process.env.JOB_OFFER_MIGRATION_COOKIE

beforeEach(() => {
  process.env.JOB_OFFER_MIGRATION_COOKIE = "cookie=abc"
  mockFindMany.mockReset().mockResolvedValue([])
  mockFindUnique.mockReset().mockResolvedValue(null)
  mockCreate.mockReset().mockResolvedValue({})
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  process.env.JOB_OFFER_MIGRATION_COOKIE = ORIGINAL_ENV
})

describe("syncJobOffers", () => {
  it("throws when fetching the first page of job offers fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as never)

    await expect(syncJobOffers()).rejects.toThrow(/status 500/)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("status 500"))
  })

  it("does nothing (and does not throw) when no migration cookie is configured", async () => {
    delete process.env.JOB_OFFER_MIGRATION_COOKIE
    vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(syncJobOffers()).resolves.toBeUndefined()

    expect(fetch).not.toHaveBeenCalled()
  })

  it("resolves without throwing when the fetch succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [], pageCount: 1 }),
    } as never)

    await expect(syncJobOffers()).resolves.toBeUndefined()
  })
})
