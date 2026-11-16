import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchJobOffers,
  fetchJobOffersPaginated,
  fetchJobOffer,
  fetchMyJobOffers,
  fetchNextInQueue,
  fetchQueueNeighbours,
  fetchSubmittedJobOffers,
} from "./job-offers"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindFirst = vi.hoisted(() => vi.fn())
const mockCount = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    jobOffer: { findMany: mockFindMany, findFirst: mockFindFirst, count: mockCount },
  },
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
    updatedAt: new Date("2026-04-16T09:30:00Z"),
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
  updatedAt: "2026-04-16T09:30:00.000Z",
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

    expect(result).toEqual([mappedSampleJob])
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

  it("sorts by createdAt descending", async () => {
    await fetchJobOffersPaginated()

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } })
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

    expect(result).toEqual({ jobs: [mappedSampleJob], total: 25, page: 2, pageCount: 3 })
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

    expect(result).toEqual(mappedSampleJob)
  })

  it("returns null when no job offer matches", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchJobOffer("no-such-job")

    expect(result).toEqual(null)
  })

  it("hides a non-published job offer from an anonymous visitor", async () => {
    mockFindFirst.mockResolvedValue(makeRow({ onlineStatus: "submitted" }))

    const result = await fetchJobOffer("developer-1")

    expect(result).toEqual(null)
  })

  it("hides a non-published job offer from a logged-in non-owner", async () => {
    mockFindFirst.mockResolvedValue(makeRow({ onlineStatus: "submitted", ownerId: "owner-1" }))

    const result = await fetchJobOffer("developer-1", { userId: "someone-else" })

    expect(result).toEqual(null)
  })

  it("shows a non-published job offer to its owner", async () => {
    mockFindFirst.mockResolvedValue(makeRow({ onlineStatus: "submitted", ownerId: "owner-1" }))

    const result = await fetchJobOffer("developer-1", { userId: "owner-1" })

    expect(result?.slug).toBe("developer-1")
  })

  it("shows a non-published job offer to a moderator", async () => {
    mockFindFirst.mockResolvedValue(makeRow({ onlineStatus: "rejected", ownerId: "owner-1" }))

    const result = await fetchJobOffer("developer-1", { userId: "mod-1", isModerator: true })

    expect(result?.slug).toBe("developer-1")
  })
})

describe("fetchMyJobOffers", () => {
  it("filters by the given ownerId, sorts by createdAt descending and paginates", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await fetchMyJobOffers("user-42", { page: 3, pageSize: 10 })

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { ownerId: "user-42" },
      orderBy: { createdAt: "desc" },
      skip: 20,
      take: 10,
    })
    expect(mockCount).toHaveBeenCalledWith({ where: { ownerId: "user-42" } })
  })

  it("matches the search term against title and company", async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    await fetchMyJobOffers("user-42", { search: "barista" })

    const where = {
      ownerId: "user-42",
      OR: [
        { title: { contains: "barista", mode: "insensitive" } },
        { company: { contains: "barista", mode: "insensitive" } },
      ],
    }
    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(mockCount).toHaveBeenCalledWith({ where })
  })

  it("returns mapped job offers with page info", async () => {
    mockFindMany.mockResolvedValue([makeRow()])
    mockCount.mockResolvedValue(45)

    const result = await fetchMyJobOffers("user-42")

    expect(result).toEqual({ jobs: [mappedSampleJob], total: 45, page: 1, pageCount: 3 })
  })
})

describe("review queue", () => {
  // An in-memory job_offer table for the where/orderBy subset the queue uses, so that the tests
  // check the resulting order rather than restate the query. Unknown operators throw.
  type Row = ReturnType<typeof makeRow>
  type Query = { where?: Record<string, unknown>; orderBy?: Record<string, "asc" | "desc">[] }
  let rows: Row[]

  const val = (x: unknown) => (x instanceof Date ? x.getTime() : x) as number | string
  function matches(row: Row, where: Record<string, unknown>): boolean {
    return Object.entries(where).every(([key, cond]) => {
      if (key === "OR") return (cond as Record<string, unknown>[]).some((w) => matches(row, w))
      const v = val(row[key as keyof Row])
      if (!cond || typeof cond !== "object" || cond instanceof Date) return v === val(cond)
      return Object.entries(cond).every(([op, x]) => {
        if (op === "lt") return v < val(x)
        if (op === "gt") return v > val(x)
        if (op === "not") return v !== val(x)
        throw new Error(`unsupported operator ${op}`)
      })
    })
  }
  function query({ where = {}, orderBy = [] }: Query): Row[] {
    return rows
      .filter((row) => matches(row, where))
      .sort((a, b) => {
        for (const order of orderBy) {
          const [key, dir] = Object.entries(order)[0]
          const [x, y] = [val(a[key as keyof Row]), val(b[key as keyof Row])]
          if (x !== y) return (x < y ? -1 : 1) * (dir === "asc" ? 1 : -1)
        }
        return 0
      })
  }

  const at = (day: number) => new Date(`2026-11-0${day}T10:00:00Z`)
  const row = (id: string, day: number, onlineStatus = "submitted") =>
    makeRow({ id, slug: id, createdAt: at(day), onlineStatus })
  const queueJob = (r: Row) => ({
    id: r.id,
    createdAt: r.createdAt.toISOString(),
    online_status: r.onlineStatus as "submitted",
  })
  function byId(id: string): Row {
    const found = rows.find((r) => r.id === id)
    if (!found) throw new Error(`no row ${id}`)
    return found
  }

  beforeEach(() => {
    // Queue order: a, b, c, d. b and c share createdAt, thus the id decides. Shuffled on purpose.
    rows = [row("d", 3), row("c", 2), row("x", 1, "published"), row("a", 1), row("b", 2)]
    mockFindMany.mockImplementation(async (q: Query) => query(q))
    mockFindFirst.mockImplementation(async (q: Query) => query(q)[0] ?? null)
    mockCount.mockImplementation(async (q: Query) => query(q).length)
  })

  it("lists the submitted offers oldest first, with the id breaking ties", async () => {
    const jobs = await fetchSubmittedJobOffers()
    expect(jobs.map((j) => j.id)).toEqual(["a", "b", "c", "d"])
  })

  it.each([
    ["a", 1, null, "b"],
    ["b", 2, "a", "c"],
    ["c", 3, "b", "d"],
    ["d", 4, "c", null],
  ])("places %s at position %i between %s and %s", async (id, position, previous, next) => {
    const queue = await fetchQueueNeighbours(queueJob(byId(id)))
    expect(queue).toEqual({
      count: 4,
      position,
      previous: previous && expect.objectContaining({ slug: previous }),
      next: next && expect.objectContaining({ slug: next }),
    })
  })

  it("keeps the neighbours of an offer that has left the queue", async () => {
    byId("b").onlineStatus = "published"
    const queue = await fetchQueueNeighbours(queueJob(byId("b")))
    expect(queue.count).toBe(3)
    expect(queue.previous?.slug).toBe("a")
    expect(queue.next?.slug).toBe("c")
  })

  it("moves on to the next offer after a decision", async () => {
    byId("b").onlineStatus = "rejected"
    expect((await fetchNextInQueue(queueJob(byId("b"))))?.slug).toBe("c")
  })

  it("wraps around to the head of the queue past its end", async () => {
    byId("d").onlineStatus = "published"
    expect((await fetchNextInQueue(queueJob(byId("d"))))?.slug).toBe("a")
  })

  it("returns null once the queue holds no other offer", async () => {
    for (const r of rows) r.onlineStatus = "published"
    byId("c").onlineStatus = "submitted"
    expect(await fetchNextInQueue(queueJob(byId("c")))).toBeNull()
  })
})
