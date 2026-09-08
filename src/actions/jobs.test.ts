import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@/generated/prisma/client"

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

const mockCanModerateJobOffers = vi.hoisted(() => vi.fn())

vi.mock("@/utils/authz", () => ({
  canModerateJobOffers: mockCanModerateJobOffers,
}))

import { jobs } from "./jobs"

function makeContext(userId?: string, emailVerified = true, role: string | null = null) {
  return { locals: { user: userId ? { id: userId, emailVerified, role } : null } }
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
  mockCanModerateJobOffers.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("jobs.create", () => {
  beforeEach(() => {
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

  it("sets offlineAfter to roughly 30 days from now", async () => {
    await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const offlineAfter: Date = mockCreate.mock.calls[0][0].data.offlineAfter
    const expected = Date.now() + 30 * 24 * 60 * 60 * 1000
    expect(offlineAfter.getTime()).toBeGreaterThan(expected - 5000)
    expect(offlineAfter.getTime()).toBeLessThanOrEqual(expected + 5000)
  })

  it("retries with a discriminated slug when the create hits the unique index", async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate slug"), { code: "P2002", meta: { target: ["slug"] } })
    )

    await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("developer")
    expect(mockCreate.mock.calls[1][0].data.slug).toMatch(/^developer-[a-z0-9]{4}$/)
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

  it("throws INTERNAL_SERVER_ERROR when the create fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the create fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )

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
  /** The stored row that agrees with `baseInput`. A test thus selects a content change. */
  function makeExistingJob(overrides: Record<string, unknown> = {}) {
    return {
      ownerId: "user-1",
      onlineStatus: "published",
      title: baseInput.title,
      company: baseInput.company,
      location: baseInput.location,
      workingHours: baseInput.working_hours,
      description: baseInput.description,
      jobType: baseInput.job_type,
      field: baseInput.field,
      workMode: baseInput.work_mode,
      externalUrl: null,
      contactName: baseInput.contact_name,
      contactMail: null,
      contactPhone: null,
      ...overrides,
    }
  }

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
    mockFindUnique.mockResolvedValue(makeExistingJob())
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await jobs.update(
      { ...baseInput, id: "job-1", title: "Senior Developer" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({ title: "Senior Developer" }),
      })
    )
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("sends a published job offer back to moderation when its owner changes the content", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob())
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      {
        ...baseInput,
        id: "job-1",
        description: "Buy cheap pills",
        external_url: "https://spam.example",
      },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onlineStatus: "submitted", rejectionReason: null }),
      })
    )
  })

  it("sends a rejected job offer back to moderation and clears the rejection reason", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob({ onlineStatus: "rejected" }))
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      { ...baseInput, id: "job-1", description: "Now with the details you asked for" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ onlineStatus: "submitted", rejectionReason: null }),
      })
    )
  })

  it("keeps a published job offer online when the owner submits unchanged content", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob())
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      { ...baseInput, id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("onlineStatus")
  })

  it("leaves an archived job offer archived when its owner edits it", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob({ onlineStatus: "archived" }))
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      { ...baseInput, id: "job-1", title: "Senior Developer" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("onlineStatus")
  })

  it("keeps a published job offer online when a moderator edits it", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob({ ownerId: "someone-else" }))
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      { ...baseInput, id: "job-1", description: "Tidied up by moderation" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("mod-1", true, "jobModerator")
    )

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("onlineStatus")
  })

  it("keeps a published job offer online when a moderator edits their own offer", async () => {
    mockFindUnique.mockResolvedValue(makeExistingJob({ ownerId: "mod-1" }))
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    await jobs.update(
      { ...baseInput, id: "job-1", description: "Tidied up by moderation" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("mod-1", true, "jobModerator")
    )

    expect(mockUpdate.mock.calls[0][0].data).not.toHaveProperty("onlineStatus")
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue(makeExistingJob())
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.update(
        { ...baseInput, id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the update fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue(makeExistingJob())
    mockUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )

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

describe("jobs.approve", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.approve(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot moderate job offers", async () => {
    mockCanModerateJobOffers.mockResolvedValue(false)

    await expect(
      jobs.approve(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("sets onlineStatus to 'published' when the user can moderate job offers", async () => {
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await jobs.approve(
      { id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("moderator-1", true, "jobModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { onlineStatus: "published", rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.approve(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("moderator-1", true, "jobModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("jobs.reject", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      jobs.reject(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot moderate job offers", async () => {
    mockCanModerateJobOffers.mockResolvedValue(false)

    await expect(
      jobs.reject(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("sets onlineStatus to 'rejected' when the user can moderate job offers", async () => {
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    const result = await jobs.reject(
      { id: "job-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("moderator-1", true, "jobModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { onlineStatus: "rejected", rejectionReason: null },
    })
    expect(result).toEqual({})
  })

  it("stores the given reason", async () => {
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockResolvedValue({})

    await jobs.reject(
      { id: "job-1", reason: "Doesn't meet posting guidelines" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("moderator-1", true, "jobModerator")
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "job-1" },
      data: { onlineStatus: "rejected", rejectionReason: "Doesn't meet posting guidelines" },
    })
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanModerateJobOffers.mockResolvedValue(true)
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      jobs.reject(
        { id: "job-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("moderator-1", true, "jobModerator")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
