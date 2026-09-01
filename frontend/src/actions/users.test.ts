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
const mockSetRole = vi.hoisted(() => vi.fn())
const mockCreateUser = vi.hoisted(() => vi.fn())
const mockRequestPasswordReset = vi.hoisted(() => vi.fn())

vi.mock("@/utils/auth", () => ({
  auth: {
    api: {
      banUser: mockBanUser,
      unbanUser: mockUnbanUser,
      setRole: mockSetRole,
      createUser: mockCreateUser,
      requestPasswordReset: mockRequestPasswordReset,
    },
  },
}))

const mockCanManageUsers = vi.hoisted(() => vi.fn())
const mockCanSetUserRoles = vi.hoisted(() => vi.fn())
const mockCanInviteUsers = vi.hoisted(() => vi.fn())

vi.mock("@/utils/authz", () => ({
  canManageUsers: mockCanManageUsers,
  canSetUserRoles: mockCanSetUserRoles,
  canInviteUsers: mockCanInviteUsers,
  USER_ROLES: ["user", "jobModerator", "eventModerator", "admin"],
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
  mockSetRole.mockReset()
  mockCreateUser.mockReset()
  mockRequestPasswordReset.mockReset()
  mockCanManageUsers.mockReset()
  mockCanSetUserRoles.mockReset()
  mockCanInviteUsers.mockReset()
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

describe("users.setRole", () => {
  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      users.setRole(
        { id: "user-1", role: "admin" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot set roles", async () => {
    mockCanSetUserRoles.mockResolvedValue(false)

    await expect(
      users.setRole(
        { id: "user-1", role: "admin" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("throws BAD_REQUEST when changing your own role", async () => {
    mockCanSetUserRoles.mockResolvedValue(true)

    await expect(
      users.setRole(
        { id: "admin-1", role: "user" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(mockSetRole).not.toHaveBeenCalled()
  })

  it("sets the target user's role when the current user is allowed to", async () => {
    mockCanSetUserRoles.mockResolvedValue(true)
    mockSetRole.mockResolvedValue({})

    const result = await users.setRole(
      { id: "user-1", role: "jobModerator" },
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockSetRole).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { userId: "user-1", role: "jobModerator" },
    })
    expect(result).toEqual({})
  })

  it("throws BAD_REQUEST when better-auth rejects the role change", async () => {
    mockCanSetUserRoles.mockResolvedValue(true)
    mockSetRole.mockRejectedValue(new MockAPIError("BAD_REQUEST"))

    await expect(
      users.setRole(
        { id: "user-1", role: "admin" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("throws INTERNAL_SERVER_ERROR when the role change fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanSetUserRoles.mockResolvedValue(true)
    mockSetRole.mockRejectedValue(new Error("db error"))

    await expect(
      users.setRole(
        { id: "user-1", role: "admin" },
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })
})

describe("users.invite", () => {
  const input = { email: "new@example.com", name: "New User", role: "user" as const }

  it("throws UNAUTHORIZED when not logged in", async () => {
    await expect(
      users.invite(
        input,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext()
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("throws FORBIDDEN when the user cannot invite users", async () => {
    mockCanInviteUsers.mockResolvedValue(false)

    await expect(
      users.invite(
        input,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("mod-1", "eventModerator")
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("creates the user and sends a password-reset email when allowed", async () => {
    mockCanInviteUsers.mockResolvedValue(true)
    mockCreateUser.mockResolvedValue({ user: { id: "new-1" } })
    mockRequestPasswordReset.mockResolvedValue({ status: true })

    const result = await users.invite(
      input,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(mockCreateUser).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { email: "new@example.com", name: "New User", role: "user" },
    })
    expect(mockRequestPasswordReset).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      body: { email: "new@example.com", redirectTo: "/reset-password" },
    })
    expect(result).toEqual({})
  })

  it("throws BAD_REQUEST when the email is already in use", async () => {
    mockCanInviteUsers.mockResolvedValue(true)
    mockCreateUser.mockRejectedValue(new MockAPIError("BAD_REQUEST"))

    await expect(
      users.invite(
        input,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
    expect(mockRequestPasswordReset).not.toHaveBeenCalled()
  })

  it("throws INTERNAL_SERVER_ERROR when user creation fails unexpectedly", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanInviteUsers.mockResolvedValue(true)
    mockCreateUser.mockRejectedValue(new Error("db error"))

    await expect(
      users.invite(
        input,
        // @ts-expect-error - needed because of mocked defineAction function
        makeContext("admin-1", "admin")
      )
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" })
  })

  it("still succeeds when the invite email fails to send", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mockCanInviteUsers.mockResolvedValue(true)
    mockCreateUser.mockResolvedValue({ user: { id: "new-1" } })
    mockRequestPasswordReset.mockRejectedValue(new Error("mail error"))

    const result = await users.invite(
      input,
      // @ts-expect-error - needed because of mocked defineAction function
      makeContext("admin-1", "admin")
    )

    expect(result).toEqual({})
  })
})
