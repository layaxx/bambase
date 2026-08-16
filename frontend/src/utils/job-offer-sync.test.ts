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

  it("sets offlineAfter from the source's offline_date when creating a job offer", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [
          {
            id: "1",
            user_id: "1",
            title: "Werkstudent",
            description: "<p>desc</p>",
            company_name: "ACME",
            url: "https://example.com",
            location: "Bamberg",
            creation_date: "2026-01-01T00:00:00.000Z",
            hours_per_week: "20",
            qualification: "",
            status: "1",
            category_id: "1",
            contact_person: "HR",
            contact_tel: "0123456789",
            contact_mail: "hr@example.com",
            uuid: "job-1",
            offline_date: "2026-06-01T00:00:00.000Z",
            file_path: "",
          },
        ],
        pageCount: 1,
      }),
    } as never)

    await syncJobOffers()

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ offlineAfter: new Date("2026-06-01T00:00:00.000Z") }),
      })
    )
  })
})
