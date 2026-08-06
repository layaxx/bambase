import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:actions", () => ({
  defineAction: ({ handler }: never) => handler,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))

vi.mock("astro/zod", async () => await import("zod"))

vi.mock("@/utils/api/job-offers", () => ({
  JOB_TYPES: [
    "part_time",
    "internship",
    "working_student",
    "research_assistant",
    "thesis",
    "volunteer",
    "other",
  ] as const,
  JOB_FIELDS: [
    "it",
    "marketing",
    "administration",
    "research",
    "gastronomy",
    "retail",
    "education",
    "other",
  ] as const,
  WORK_MODES: ["on_site", "hybrid", "remote"] as const,
}))

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    jobOffer: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

import { jobs } from "./jobs"

function makeContext(userId?: string, emailVerified = true) {
  return { locals: { user: userId ? { id: userId, emailVerified } : null } }
}

const baseInput = {
  title: "Developer",
  company: "ACME",
  location: "Remote",
  working_hours: 20,
  description: "Build things",
  job_type: "other",
  field: "it",
  work_mode: "on_site",
  contact_name: "HR",
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("jobs.create", () => {
  beforeEach(() => {
    mockFindUnique.mockResolvedValue(null) // slug is always free
    mockCreate.mockResolvedValue({ slug: "developer" })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the current user's email is not verified", async () => {
    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1", false)
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("sets ownerId to the current user's id", async () => {
    await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.ownerId).toBe("user-1")
  })

  it("appends -2 to the slug when the base slug is already taken", async () => {
    mockFindUnique.mockResolvedValueOnce({ id: "other-job" }).mockResolvedValueOnce(null)

    await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("developer-2")
  })

  it("returns slug from the created job offer", async () => {
    mockCreate.mockResolvedValue({ slug: "created-slug" })

    const result = await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("throws BAD_REQUEST when the create fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("includes job_type, field, and work_mode in the data", async () => {
    await jobs.create(
      { ...baseInput, job_type: "internship", field: "it", work_mode: "remote" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ jobType: "internship", field: "it", workMode: "remote" })
  })
})

describe("jobs.update", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.update(
        { ...baseInput, id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the job offer doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      jobs.update(
        { ...baseInput, id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the current user does not own the job offer", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })

    await expect(
      jobs.update(
        { ...baseInput, id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("updates the job offer and returns its slug when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await jobs.update(
      { ...baseInput, id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "job-1" } }))
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("throws BAD_REQUEST when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.update(
        { ...baseInput, id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("jobs.delete", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.delete(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the job offer doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      jobs.delete(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the current user does not own the job offer", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })

    await expect(
      jobs.delete(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("deletes the job offer and returns {} when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })

    const result = await jobs.delete(
      { id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "job-1" } })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockDelete.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.delete(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("jobs.archive", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.archive(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws NOT_FOUND when the job offer doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      jobs.archive(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("throws FORBIDDEN when the current user does not own the job offer", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "someone-else" })

    await expect(
      jobs.archive(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("sets onlineStatus to 'archived' when the user is the owner", async () => {
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockResolvedValue({})

    const result = await jobs.archive(
      { id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { onlineStatus: "archived" },
    })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ ownerId: "user-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.archive(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
