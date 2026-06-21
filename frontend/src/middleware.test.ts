import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: CallableFunction) => fn,
}))

vi.mock("astro:env/client", () => ({
  STRAPI_URL: "http://strapi.test",
}))

vi.mock("@/utils/auth-cookies", () => ({
  updateJwtCookie: vi.fn(),
  updateRefreshTokenCookie: vi.fn(),
  deleteAuthCookies: vi.fn(),
}))

import { onRequest } from "./middleware"
import type { APIContext } from "astro"
import { deleteAuthCookies, updateJwtCookie, updateRefreshTokenCookie } from "@/utils/auth-cookies"

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${payloadB64}.sig`
}

function futureExp(seconds: number) {
  return Math.floor(Date.now() / 1000) + seconds
}

function makeContext({
  cookieLocale,
  acceptLanguage,
  authToken,
  refreshToken,
}: {
  cookieLocale?: string
  acceptLanguage?: string | null
  authToken?: string
  refreshToken?: string
}) {
  const deletedCookies: string[] = []
  return {
    cookies: {
      get: (name: string) => {
        if (name === "locale" && cookieLocale !== undefined) return { value: cookieLocale }
        if (name === "auth_token" && authToken !== undefined) return { value: authToken }
        if (name === "refresh_token" && refreshToken !== undefined) return { value: refreshToken }
        return undefined
      },
      set: vi.fn(),
      delete: vi.fn((name: string) => deletedCookies.push(name)),
      _deleted: deletedCookies,
    },
    request: {
      headers: {
        get: (name: string) => (name === "Accept-Language" ? (acceptLanguage ?? null) : null),
      },
    },
    locals: {} as Record<string, unknown>,
  } as unknown as APIContext<Record<string, unknown>, Record<string, string | undefined>>
}

describe("onRequest middleware", () => {
  const next = vi.fn().mockResolvedValue(new Response())

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(global.fetch).mockReset?.()
  })

  it("uses a valid 'de' cookie", async () => {
    const ctx = makeContext({ cookieLocale: "de" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("de")
  })

  it("falls back to Accept-Language when cookie value is unsupported", async () => {
    const ctx = makeContext({ cookieLocale: "fr", acceptLanguage: "en-US,en;q=0.9" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("en")
  })

  it("parses Accept-Language 'en-US' → 'en'", async () => {
    const ctx = makeContext({ acceptLanguage: "en-US,en;q=0.9" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("en")
  })

  it("picks the preferred supported locale from Accept-Language sorted", async () => {
    const ctx = makeContext({ acceptLanguage: "de-DE,de;q=0.9,en;q=0.8" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("de")
  })

  it("picks the preferred supported locale from Accept-Language unsorted", async () => {
    const ctx = makeContext({ acceptLanguage: "en;q=0.8,de-DE,de;q=0.9" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("de")
  })

  it("skips unsupported locales and finds a supported one later in Accept-Language", async () => {
    const ctx = makeContext({ acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.8" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("en")
  })

  it("defaults to 'de' when Accept-Language has no supported locale", async () => {
    const ctx = makeContext({ acceptLanguage: "zh-CN,zh;q=0.9" })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("de")
  })

  it("defaults to 'de' when Accept-Language header is absent", async () => {
    const ctx = makeContext({ acceptLanguage: null })
    await onRequest(ctx, next)
    expect(ctx.locals.locale).toBe("de")
  })

  it("sets a locale cookie when locale is resolved from Accept-Language", async () => {
    const ctx = makeContext({ acceptLanguage: "en-US,en;q=0.9" })
    await onRequest(ctx, next)
    expect(ctx.cookies.set).toHaveBeenCalledWith(
      "locale",
      "en",
      expect.objectContaining({ httpOnly: true })
    )
  })

  it("does not set a locale cookie when a valid locale cookie is already present", async () => {
    const ctx = makeContext({ cookieLocale: "de" })
    await onRequest(ctx, next)
    expect(ctx.cookies.set).not.toHaveBeenCalled()
  })

  it("calls next()", async () => {
    const ctx = makeContext({ cookieLocale: "de" })
    const mockNext = vi.fn().mockResolvedValue(new Response())
    await onRequest(ctx, mockNext)
    expect(mockNext).toHaveBeenCalled()
  })

  describe("auth token validation", () => {
    it("sets locals.user to null when no cookies are present", async () => {
      const ctx = makeContext({ cookieLocale: "de" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
    })

    it("sets locals.user from JWT when token is well-formed and not expired", async () => {
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: makeToken({ id: 1, exp: futureExp(900) }),
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toEqual({ id: 1 })
    })

    it("makes no network call when JWT is valid", async () => {
      const fetchSpy = vi.spyOn(global, "fetch")
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: makeToken({ id: 1, exp: futureExp(900) }),
      })
      await onRequest(ctx, next)
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it("clears cookies and sets locals.user to null when token is malformed", async () => {
      const ctx = makeContext({ cookieLocale: "de", authToken: "bad.token.here" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).toHaveBeenCalledWith(ctx.cookies)
    })

    it("clears cookies when JWT is expired and no refresh token is present", async () => {
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: makeToken({ id: 1, exp: futureExp(-60) }),
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).toHaveBeenCalledWith(ctx.cookies)
    })
  })

  describe("refresh token flow", () => {
    const expiredToken = () => makeToken({ id: 1, exp: futureExp(-60) })
    const validExchangeResponse = () =>
      new Response(
        JSON.stringify({
          jwt: makeToken({ id: 1, exp: futureExp(900) }),
          refreshToken: "new-refresh-token",
        }),
        { status: 200 }
      )

    it("calls /api/auth/refresh when JWT is expired and refresh token exists", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(validExchangeResponse())
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: expiredToken(),
        refreshToken: "old-refresh-token",
      })
      await onRequest(ctx, next)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/refresh"),
        expect.objectContaining({ method: "POST" })
      )
    })

    it("sets locals.user and updates cookies when refresh succeeds", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(validExchangeResponse())
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: expiredToken(),
        refreshToken: "old-refresh-token",
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toEqual({ id: 1 })
      expect(updateJwtCookie).toHaveBeenCalled()
      expect(updateRefreshTokenCookie).toHaveBeenCalledWith(ctx.cookies, "new-refresh-token")
    })

    it("calls /api/auth/refresh when auth_token is absent but refresh_token exists", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(validExchangeResponse())
      const ctx = makeContext({ cookieLocale: "de", refreshToken: "some-refresh-token" })
      await onRequest(ctx, next)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/refresh"),
        expect.objectContaining({ method: "POST" })
      )
      expect(ctx.locals.user).toEqual({ id: 1 })
    })

    it("clears cookies when refresh returns 401", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 401 }))
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: expiredToken(),
        refreshToken: "bad-refresh-token",
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).toHaveBeenCalledWith(ctx.cookies)
    })

    it("leaves cookies intact and sets user to null when refresh fails with server error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 500 }))
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: expiredToken(),
        refreshToken: "valid-refresh-token",
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).not.toHaveBeenCalled()
    })

    it("leaves cookies intact and sets user to null when refresh network call throws", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("network error"))
      const ctx = makeContext({
        cookieLocale: "de",
        authToken: expiredToken(),
        refreshToken: "valid-refresh-token",
      })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).not.toHaveBeenCalled()
    })
  })
})
