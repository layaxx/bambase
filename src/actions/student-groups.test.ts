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

const mockFindUnique = vi.hoisted(() => vi.fn())
const mockCreate = vi.hoisted(() => vi.fn())
const mockUpdate = vi.hoisted(() => vi.fn())
const mockDelete = vi.hoisted(() => vi.fn())

vi.mock("@/utils/prisma", () => ({
  default: {
    studentGroup: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}))

const mockCanManageStudentGroups = vi.hoisted(() => vi.fn())
vi.mock("@/utils/authz", () => ({
  canManageStudentGroups: mockCanManageStudentGroups,
}))

import { studentGroups } from "./student-groups"

function makeContext(userId?: string) {
  return { locals: { user: userId ? { id: userId, role: "admin" } : null } }
}

const baseGroupInput = {
  name: "Test Group",
  description: "A group for testing.",
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockCreate.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockCanManageStudentGroups.mockReset()
  mockCanManageStudentGroups.mockResolvedValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("studentGroups.create", () => {
  beforeEach(() => {
    mockCreate.mockResolvedValue({ slug: "test-group" })
  })

  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      studentGroups.create(
        baseGroupInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the studentGroup:manage permission", async () => {
    mockCanManageStudentGroups.mockResolvedValue(false)

    await expect(
      studentGroups.create(
        baseGroupInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("retries with a discriminated slug when the create hits the unique index", async () => {
    mockCreate.mockRejectedValueOnce(
      Object.assign(new Error("duplicate slug"), { code: "P2002", meta: { target: ["slug"] } })
    )

    await studentGroups.create(
      baseGroupInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockCreate.mock.calls[0][0].data.slug).toBe("test-group")
    expect(mockCreate.mock.calls[1][0].data.slug).toMatch(/^test-group-[a-z0-9]{4}$/)
  })

  it("returns slug from the created group", async () => {
    mockCreate.mockResolvedValue({ slug: "created-slug" })

    const result = await studentGroups.create(
      baseGroupInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("writes name and description to the data", async () => {
    await studentGroups.create(
      baseGroupInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data).toMatchObject({ name: "Test Group", description: "A group for testing." })
  })

  it("falls back to null for optional fields when omitted", async () => {
    await studentGroups.create(
      baseGroupInput,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    const data = mockCreate.mock.calls[0][0].data
    expect(data.website).toBeNull()
    expect(data.instagram).toBeNull()
    expect(data.facebook).toBeNull()
    expect(data.email).toBeNull()
  })

  it("throws INTERNAL_SERVER_ERROR when the create fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCreate.mockRejectedValue(new Error("db error"))

    await expect(
      studentGroups.create(
        baseGroupInput,
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
      studentGroups.create(
        baseGroupInput,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("studentGroups.update", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      studentGroups.update(
        { ...baseGroupInput, id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the studentGroup:manage permission", async () => {
    mockCanManageStudentGroups.mockResolvedValue(false)

    await expect(
      studentGroups.update(
        { ...baseGroupInput, id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws NOT_FOUND when the group doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      studentGroups.update(
        { ...baseGroupInput, id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("updates the group and returns its slug", async () => {
    mockFindUnique.mockResolvedValue({ id: "group-1" })
    mockUpdate.mockResolvedValue({ slug: "updated-slug" })

    const result = await studentGroups.update(
      { ...baseGroupInput, id: "group-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "group-1" } }))
    expect(result).toEqual({ slug: "updated-slug" })
  })

  it("throws INTERNAL_SERVER_ERROR when the update fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ id: "group-1" })
    mockUpdate.mockRejectedValue(new Error("db error"))

    await expect(
      studentGroups.update(
        { ...baseGroupInput, id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("throws BAD_REQUEST when the update fails due to a known constraint violation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ id: "group-1" })
    mockUpdate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      })
    )

    await expect(
      studentGroups.update(
        { ...baseGroupInput, id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })
})

describe("studentGroups.delete", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      studentGroups.delete(
        { id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user lacks the studentGroup:manage permission", async () => {
    mockCanManageStudentGroups.mockResolvedValue(false)

    await expect(
      studentGroups.delete(
        { id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws NOT_FOUND when the group doesn't exist", async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      studentGroups.delete(
        { id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" })
  })

  it("deletes the group and returns {}", async () => {
    mockFindUnique.mockResolvedValue({ id: "group-1" })

    const result = await studentGroups.delete(
      { id: "group-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("user-1")
    )

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "group-1" } })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the delete fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockFindUnique.mockResolvedValue({ id: "group-1" })
    mockDelete.mockRejectedValue(new Error("db error"))

    await expect(
      studentGroups.delete(
        { id: "group-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("user-1")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
