import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: CallableFunction) => fn,
}))

vi.mock("astro:env/client", () => ({
  STRAPI_URL: "http://strapi.test",
}))

vi.mock("@/utils/auth-cookies", () => ({
  updateJwtCookie: vi.fn(),
  deleteAuthCookies: vi.fn(),
}))

import { onRequest } from "./middleware"
import type { APIContext } from "astro"
import { deleteAuthCookies, updateJwtCookie } from "@/utils/auth-cookies"

function makeToken(exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ id: 1, exp })).toString("base64url")
  return `${header}.${payload}.sig`
}

function makeContext({
  cookieLocale,
  acceptLanguage,
  authToken,
}: {
  cookieLocale?: string
  acceptLanguage?: string | null
  authToken?: string
}) {
  const deletedCookies: string[] = []
  return {
    cookies: {
      get: (name: string) => {
        if (name === "locale" && cookieLocale !== undefined) return { value: cookieLocale }
        if (name === "auth_token" && authToken !== undefined) return { value: authToken }
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
    it("sets locals.user to null when no auth_token cookie is present", async () => {
      const ctx = makeContext({ cookieLocale: "de" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
    })

    it("sets locals.user from /api/users/me when token is valid", async () => {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3 // 3 days from now
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" }),
          {
            status: 200,
          }
        )
      )
      const ctx = makeContext({ cookieLocale: "de", authToken: makeToken(exp) })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toEqual({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" })
    })

    it("clears cookies and sets locals.user to null when /api/users/me returns 401", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(new Response(null, { status: 401 }))
      const ctx = makeContext({ cookieLocale: "de", authToken: "bad.token.here" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(deleteAuthCookies).toHaveBeenCalledWith(ctx.cookies)
    })

    it("does not call /api/auth/refresh when token expiry is more than 24h away", async () => {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 3 // 3 days from now
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" }),
          {
            status: 200,
          }
        )
      )
      const ctx = makeContext({ cookieLocale: "de", authToken: makeToken(exp) })
      await onRequest(ctx, next)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/users/me"),
        expect.anything()
      )
    })

    it("calls /api/auth/refresh and updates cookie when token expires within 24h", async () => {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 hours from now
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ jwt: "new.jwt.token" }), { status: 200 })
        )
      const ctx = makeContext({ cookieLocale: "de", authToken: makeToken(exp) })
      await onRequest(ctx, next)
      expect(updateJwtCookie).toHaveBeenCalledWith(ctx.cookies, "new.jwt.token")
    })

    it("keeps locals.user set even if refresh call fails", async () => {
      const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2 hours from now
      vi.spyOn(global, "fetch")
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(new Response(null, { status: 500 }))
      const ctx = makeContext({ cookieLocale: "de", authToken: makeToken(exp) })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toEqual({ id: 1, email: "seed@example.com", createdAt: "2024-01-01" })
      expect(updateJwtCookie).not.toHaveBeenCalled()
    })
  })
})
