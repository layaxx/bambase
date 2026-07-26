import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchStudentGroups } from "./student-groups"

const mockFindMany = vi.hoisted(() => vi.fn())

vi.mock("../prisma", () => ({
  default: {
    studentGroup: { findMany: mockFindMany },
  },
}))

vi.mock("./cache", () => ({
  withCache: (_key: string, fn: () => Promise<unknown>) => fn(),
}))

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
  beforeEach(() => mockFindMany.mockReset())

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
