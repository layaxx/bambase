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

vi.mock("./cache", () => ({
  withCache: (_key: string, fn: () => Promise<unknown>) => fn(),
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

    expect(result).toEqual({
      data: [
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
      ],
      apiDown: false,
    })
  })

  it("returns an empty array when no rows are found", async () => {
    mockFindMany.mockResolvedValue([])

    const result = await fetchStudentGroups()

    expect(result).toEqual({ data: [], apiDown: false })
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockResolvedValue(null)

    const result = await fetchStudentGroups()

    expect(result).toEqual({ data: [], apiDown: true })
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching student groups", expect.any(TypeError))
    consoleSpy.mockRestore()
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

    expect(result).toEqual({ data: null, apiDown: false })
  })

  it("maps the found row to a StudentGroup", async () => {
    mockFindFirst.mockResolvedValue(sampleGroupRow)

    const result = await fetchStudentGroupForAdmin("asta")

    expect(result.data).toMatchObject({ id: "grp-1", slug: "asta", name: "AStA" })
  })

  it("logs an error and returns apiDown when the lookup throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindFirst.mockRejectedValue(new Error("db error"))

    const result = await fetchStudentGroupForAdmin("asta")

    expect(result).toEqual({ data: null, apiDown: true })
    consoleSpy.mockRestore()
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

  it("logs an error and returns an empty array when the query throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindMany.mockRejectedValue(new Error("db error"))

    const result = await fetchAllStudentGroupsForAdmin()

    expect(result).toEqual({ data: [], apiDown: true })
    consoleSpy.mockRestore()
  })
})
