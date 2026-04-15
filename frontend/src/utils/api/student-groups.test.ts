import { beforeEach, describe, expect, it, vi } from "vitest"
import { fetchStudentGroups } from "./student-groups"

const mockFind = vi.hoisted(() => vi.fn())

vi.mock("./client", () => ({
  client: {
    collection: vi.fn().mockReturnValue({ find: mockFind }),
  },
  strapiUrl: "http://localhost:1337",
}))

const sampleGroup = {
  documentId: "grp-1",
  slug: "asta",
  name: "AStA",
  description: "Student union",
}

describe("fetchStudentGroups", () => {
  beforeEach(() => mockFind.mockReset())

  it("sorts results by name ascending", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchStudentGroups()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ sort: ["name:asc"] }))
  })

  it("uses the default limit of 200", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchStudentGroups()

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 200 } }))
  })

  it("respects a custom limit", async () => {
    mockFind.mockResolvedValue({ data: [] })

    await fetchStudentGroups(50)

    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ pagination: { limit: 50 } }))
  })

  it("returns the data array from the response", async () => {
    mockFind.mockResolvedValue({ data: [sampleGroup] })

    const result = await fetchStudentGroups()

    expect(result).toEqual([sampleGroup])
  })

  it("returns an empty array when data is null", async () => {
    mockFind.mockResolvedValue({ data: null })

    const result = await fetchStudentGroups()

    expect(result).toEqual([])
  })

  it("logs an error and returns an empty array when the API response is unexpected", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    mockFind.mockResolvedValue(null)

    const result = await fetchStudentGroups()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith("Error fetching student groups", expect.any(TypeError))
    consoleSpy.mockRestore()
  })
})
