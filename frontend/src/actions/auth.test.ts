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

vi.mock("@/utils/api", () => ({ strapiUrl: "http://localhost:1337" }))

import { auth } from "./auth"
import { getFetchBody } from "./test-helpers"

afterEach(() => vi.unstubAllGlobals())

function makeWritableCookies(values: Record<string, string> = {}) {
  const store: Record<string, string> = { ...values }
  return {
    get: (name: string) => (store[name] !== undefined ? { value: store[name] } : undefined),
    set: vi.fn((name: string, value: string, _options?: Record<string, unknown>) => {
      store[name] = value
    }),
  }
}

describe("auth.login", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("returns success: true and sets cookies on valid credentials", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        jwt: "my-jwt",
        user: { username: "alice", email: "alice@example.com" },
      }),
    } as Response)

    const cookies = makeWritableCookies()
    const result = await auth.login(
      { identifier: "alice@example.com", password: "secret", redirect: "/dashboard" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies }
    )

    expect(result).toEqual({ success: true, username: "alice", redirect: "/dashboard" })
    expect(cookies.set).toHaveBeenCalledWith(
      "auth_token",
      "my-jwt",
      expect.objectContaining({ httpOnly: true })
    )
    expect(cookies.set).toHaveBeenCalledWith(
      "auth_user",
      expect.stringContaining("alice"),
      expect.not.objectContaining({ httpOnly: true })
    )
  })

  it("sets auth_token with httpOnly: true, sameSite: 'strict', path: '/'", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "jwt", user: { username: "u", email: "u@e.com" } }),
    } as Response)

    const cookies = makeWritableCookies()
    await auth.login(
      { identifier: "u@e.com", password: "pass" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies }
    )

    const tokenSetCall = cookies.set.mock.calls.find(([name]) => name === "auth_token")
    expect(tokenSetCall?.[2]).toMatchObject({ httpOnly: true, sameSite: "strict", path: "/" })
  })

  it("returns success: false when credentials are wrong", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response)

    const result = await auth.login(
      { identifier: "bad@example.com", password: "wrong" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies() }
    )

    expect(result).toMatchObject({ success: false, username: "bad@example.com", redirect: null })
  })

  it("uses redirect '/' when no redirect param is provided", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "j", user: { username: "u", email: "u@e.com" } }),
    } as Response)

    const result = await auth.login(
      { identifier: "u@e.com", password: "p" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies() }
    )

    expect(result).toMatchObject({ redirect: "/" })
  })

  it("POSTs to /api/auth/local with identifier and password", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "j", user: { username: "u", email: "u@e.com" } }),
    } as Response)

    await auth.login(
      { identifier: "u@e.com", password: "pass123" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies() }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/auth/local",
      expect.objectContaining({ method: "POST" })
    )
    const body = getFetchBody()
    expect(body).toMatchObject({ identifier: "u@e.com", password: "pass123" })
  })
})

describe("auth.getMe", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie is present", async () => {
    await expect(
      auth.getMe(
        {},
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeWritableCookies() }
      )
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    })
  })

  it("returns user data when the token is valid", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 7,
        username: "alice",
        email: "alice@e.com",
        createdAt: "2026-01-01",
      }),
    } as Response)

    const result = await auth.getMe(
      {},
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies({ auth_token: "valid-jwt" }) }
    )

    expect(result).toMatchObject({ id: 7, username: "alice" })
  })

  it("sends the token in the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1, username: "u", email: "u@e.com", createdAt: "" }),
    } as Response)

    await auth.getMe(
      {},
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies({ auth_token: "bearer-token" }) }
    )

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: "Bearer bearer-token" } })
    )
  })

  it("throws UNAUTHORIZED when the API returns a non-ok response", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, json: async () => ({}) } as Response)

    await expect(
      auth.getMe(
        {},
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeWritableCookies({ auth_token: "expired" }) }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })
})

describe("auth.register", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("sets cookies and returns username on success", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "new-jwt", user: { username: "bob", email: "bob@b.com" } }),
    } as Response)

    const cookies = makeWritableCookies()
    const result = await auth.register(
      { email: "bob@b.com", password: "longpassword1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies }
    )

    expect(result).toEqual({ username: "bob" })
    expect(cookies.set).toHaveBeenCalledWith(
      "auth_token",
      "new-jwt",
      expect.objectContaining({ httpOnly: true })
    )
  })

  it("sends email as both 'email' and 'username' in the request body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "j", user: { username: "u@e.com", email: "u@e.com" } }),
    } as Response)

    await auth.register(
      { email: "u@e.com", password: "longpassword1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies() }
    )

    const body = getFetchBody()
    expect(body).toMatchObject({ email: "u@e.com", username: "u@e.com" })
  })

  it("throws BAD_REQUEST with the API error message on failure", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Email already taken" } }),
    } as Response)

    await expect(
      auth.register(
        { email: "taken@e.com", password: "longpassword1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeWritableCookies() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Email already taken" })
  })

  it("throws BAD_REQUEST with a fallback message when the API gives no error message", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response)

    await expect(
      auth.register(
        { email: "u@e.com", password: "longpassword1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeWritableCookies() }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "Registrierung fehlgeschlagen." })
  })

  it("POSTs to /api/auth/local/register", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ jwt: "j", user: { username: "u", email: "u@e.com" } }),
    } as Response)

    await auth.register(
      { email: "u@e.com", password: "longpassword1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeWritableCookies() }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/auth/local/register",
      expect.objectContaining({ method: "POST" })
    )
  })
})
