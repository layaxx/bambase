import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchStudentGroups,
  fetchStudentGroupForAdmin,
  fetchAllStudentGroupsForAdmin,
} from "./student-groups"

const mockFindMany = vi.hoisted(() => vi.fn())
const mockFindFirst = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    studentGroup: { findMany: mockFindMany, findFirst: mockFindFirst },
  },
}))

beforeEach(() => {
  mockFindMany.mockReset()
  mockFindFirst.mockReset()
})

const sampleGroupRow = {
  id: "grp-1",
  slug: "asta",
  name: "AStA",
  description: "Student union",
  website: null,
  email: null,
  facebook: null,
  instagram: null,
}

describe("fetchStudentGroups", () => {
  it("sorts results by name ascending", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchStudentGroups()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: "asc" } }))
  })

  it("uses the default limit of 200", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchStudentGroups()

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }))
  })

  it("respects a custom limit", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchStudentGroups(50)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }))
  })

  it("maps rows to StudentGroup, turning null fields into undefined", async () => {
    mockFindMany.mockResolvedValue([sampleGroupRow])

    const result = await fetchStudentGroups()

    expect(result).toEqual([
      {
        id: "grp-1",
        slug: "asta",
        name: "AStA",
        description: "Student union",
        website: undefined,
        email: undefined,
        facebook: undefined,
        instagram: undefined,
      },
    ])
  })

  it("returns an empty array when no rows are found", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await fetchStudentGroups()

    expect(result).toEqual([])
  })
})

describe("fetchStudentGroupForAdmin", () => {
  it("looks up the group by slug", async () => {
    mockFindFirst.mockResolvedValue(sampleGroupRow)

    await fetchStudentGroupForAdmin("asta")

    expect(mockFindFirst).toHaveBeenCalledWith({ where: { slug: "asta" } })
  })

  it("returns null when no group matches the slug", async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await fetchStudentGroupForAdmin("missing")

    expect(result).toEqual(null)
  })

  it("maps the found row to a StudentGroup", async () => {
    mockFindFirst.mockResolvedValue(sampleGroupRow)

    const result = await fetchStudentGroupForAdmin("asta")

    expect(result).toMatchObject({ id: "grp-1", slug: "asta", name: "AStA" })
  })
})

describe("fetchAllStudentGroupsForAdmin", () => {
  it("sorts results by name ascending with a default limit of 500", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllStudentGroupsForAdmin()

    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { name: "asc" }, take: 500 })
  })

  it("uses a custom limit when provided", async () => {
    mockFindMany.mockResolvedValue([])

    await fetchAllStudentGroupsForAdmin(10)

    expect(mockFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }))
  })
})
