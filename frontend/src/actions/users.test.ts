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

const MockAPIError = vi.hoisted(
  () =>
    class extends Error {
      status: string
      constructor(status: string) {
        super(status)
        this.status = status
      }
    }
)

vi.mock("better-auth", () => ({
  APIError: MockAPIError,
}))

const mockBanUser = vi.hoisted(() => vi.fn())
const mockUnbanUser = vi.hoisted(() => vi.fn())

vi.mock("@/utils/auth", () => ({
  auth: {
    api: {
      banUser: mockBanUser,
      unbanUser: mockUnbanUser,
    },
  },
}))

const mockCanManageUsers = vi.hoisted(() => vi.fn())

vi.mock("@/utils/authz", () => ({
  canManageUsers: mockCanManageUsers,
}))

import { users } from "./users"

function makeContext(userId?: string, role: string | null = null) {
  return {
    locals: { user: userId ? { id: userId, role } : null },
    request: { headers: new Headers() },
  }
}

beforeEach(() => {
  mockBanUser.mockReset()
  mockUnbanUser.mockReset()
  mockCanManageUsers.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("users.ban", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      users.ban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot manage users", async () => {
    mockCanManageUsers.mockResolvedValue(false)

    await expect(
      users.ban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("bans the target user when the current user can manage users", async () => {
    mockCanManageUsers.mockResolvedValue(true)
    mockBanUser.mockResolvedValue({})

    const result = await users.ban(
      { id: "user-1", reason: "Spam" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockBanUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: "user-1", banReason: "Spam" },
    })
    expect(result).toEqual({})
  })

  it("throws BAD_REQUEST when better-auth rejects the ban (e.g. self-ban)", async () => {
    mockCanManageUsers.mockResolvedValue(true)
    mockBanUser.mockRejectedValue(new MockAPIError("BAD_REQUEST"))

    await expect(
      users.ban(
        { id: "admin-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("throws INTERNAL_SERVER_ERROR when the ban call fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanManageUsers.mockResolvedValue(true)
    mockBanUser.mockRejectedValue(new Error("db error"))

    await expect(
      users.ban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("users.unban", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      users.unban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot manage users", async () => {
    mockCanManageUsers.mockResolvedValue(false)

    await expect(
      users.unban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("unbans the target user when the current user can manage users", async () => {
    mockCanManageUsers.mockResolvedValue(true)
    mockUnbanUser.mockResolvedValue({})

    const result = await users.unban(
      { id: "user-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockUnbanUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: "user-1" },
    })
    expect(result).toEqual({})
  })

  it("throws INTERNAL_SERVER_ERROR when the unban call fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanManageUsers.mockResolvedValue(true)
    mockUnbanUser.mockRejectedValue(new Error("db error"))

    await expect(
      users.unban(
        { id: "user-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})
