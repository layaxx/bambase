import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchJobOffers,
  fetchJobOffersPaginated,
  fetchJobOffer,
  fetchMyJobOffers,
} from "./job-offers"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindFirst = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    jobOffer: { findMany: mockFindMany, findFirst: mockFindFirst, count: mockCount },
  },
}))

vi.mock("./cache", () => ({
  withCache: (_key: string, fn: () => Promise<unknown>) => fn(),
}))

beforeEach(() => {
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
  mockCount.mockReset()
})

function makeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "job-123",
    slug: "developer-1",
    title: "Developer",
    description: "Build things",
    company: "ACME",
    location: "Remote",
    onlineStatus: "published",
    workingHours: 20,
    externalUrl: null,
    jobType: "other",
    field: "it",
    workMode: "on_site",
    contactName: "HR",
    contactMail: "hr@acme.com",
    contactPhone: null,
    ownerId: null,
    createdAt: new Date("2026-04-15T10:00:00Z"),
    ...overrides,
  }
}

const mappedSampleJob = {
  id: "job-123",
  slug: "developer-1",
  title: "Developer",
  description: "Build things",
  company: "ACME",
  location: "Remote",
  online_status: "published",
  working_hours: 20,
  external_url: undefined,
  job_type: "other",
  field: "it",
  work_mode: "on_site",
  contact: { name: "HR", mail: "hr@acme.com", phone: undefined },
  ownerId: null,
  reports: undefined,
  createdAt: "2026-04-15T10:00:00.000Z",
}

describe("fetchJobOffers", () => {
  it("filters by published status", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchJobOffers()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { onlineStatus: "published" } })
    )
  })

  it("uses the default limit of 100", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchJobOffers()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchJobOffers(10)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
  })

  it("returns mapped job offers from the response", async () => {
    mockFindMany.mockResolvedValue([makeRow()])

    const result = await fetchJobOffers()

    expect(result).toEqual({ data: [mappedSampleJob], apiDown: false })
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null) // null.map throws TypeError inside the try block

    const result = await fetchJobOffers()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offers", expect.any(TypeError))
  })
})

describe("fetchJobOffersPaginated", () => {
  beforeEach(() => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)
  })

  it("filters by published status", async () => {
    await fetchJobOffersPaginated()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ onlineStatus: "published" }) })
    )
  })

  it("filters by job type when provided", async () => {
    await fetchJobOffersPaginated({ types: ["internship"] })

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.jobType).toEqual({ in: ["internship"] })
  })

  it("filters by field and work mode when provided", async () => {
    await fetchJobOffersPaginated({ fields: ["it"], workModes: ["remote"] })

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.field).toEqual({ in: ["it"] })
    expect(call.where.workMode).toEqual({ in: ["remote"] })
  })

  it("filters by title/company search when provided", async () => {
    await fetchJobOffersPaginated({ search: "acme" })

    const call = mockFindMany.mock.calls[0][0]
    expect(call.where.OR).toEqual([
      { title: { contains: "acme", mode: "insensitive" } },
      { company: { contains: "acme", mode: "insensitive" } },
    ])
  })

  it("sorts by createdAt descending by default", async () => {
    await fetchJobOffersPaginated()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
    )
  })

  it("sorts by createdAt ascending when sort is 'oldest'", async () => {
    await fetchJobOffersPaginated({ sort: "oldest" })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "asc" } })
    )
  })

  it("paginates using page and pageSize", async () => {
    await fetchJobOffersPaginated({ page: 3, pageSize: 5 })

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }))
  })

  it("returns total, page, and pageCount from the count query", async () => {
    mockFindMany.mockResolvedValue([makeRow()])
    mockCount.mockResolvedValue(25)

    const result = await fetchJobOffersPaginated({ page: 2, pageSize: 12 })

    expect(result).toEqual({
      data: { jobs: [mappedSampleJob], total: 25, page: 2, pageCount: 3 },
      apiDown: false,
    })
  })

  it("logs an error and returns an empty page when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("db error"))

    const result = await fetchJobOffersPaginated()

    expect(result).toEqual({
      data: { jobs: [], total: 0, page: 1, pageCount: 1 },
      apiDown: true,
    })
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error fetching job offers (paginated)",
      expect.any(Error)
    )
  })
})

describe("fetchJobOffer", () => {
  it("filters by the given slug", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    await fetchJobOffer("developer-1")

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "developer-1" } })
    )
  })

  it("filters reports to non-dismissed", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    await fetchJobOffer("developer-1")

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
        },
      })
    )
  })

  it("returns the mapped job offer", async () => {
    mockFindFirst.mockResolvedValue(makeRow())

    const result = await fetchJobOffer("developer-1")

    expect(result).toEqual({ data: mappedSampleJob, apiDown: false })
  })

  it("returns null when no job offer matches", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchJobOffer("no-such-job")

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("logs an error and returns null when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindFirst.mockRejectedValue(new Error("connection refused"))

    const result = await fetchJobOffer("developer-1")

    expect(result).toEqual({ data: null, apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching job offer", expect.any(Error))
  })
})

describe("fetchMyJobOffers", () => {
  it("filters by the given ownerId and sorts by createdAt descending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchMyJobOffers("user-42")

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ownerId: "user-42" },
      orderBy: { createdAt: "desc" },
    })
  })

  it("returns mapped job offers from the response", async () => {
    mockFindMany.mockResolvedValue([makeRow()])

    const result = await fetchMyJobOffers("user-42")

    expect(result).toEqual({ data: [mappedSampleJob], apiDown: false })
  })

  it("logs an error and returns an empty array when the query fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("connection refused"))

    const result = await fetchMyJobOffers("user-42")

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching own job offers", expect.any(Error))
  })
})
