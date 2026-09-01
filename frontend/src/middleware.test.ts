import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: CallableFunction) => fn,
}))

const getSession = vi.fn()
vi.mock("./utils/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))

import { onRequest } from "./middleware"
import type { APIContext } from "astro"

function makeContext({
  cookieLocale,
  acceptLanguage,
}: {
  cookieLocale?: string
  acceptLanguage?: string | null
}) {
  return {
    cookies: {
      get: (name: string) => {
        if (name === "locale" && cookieLocale !== undefined) return { value: cookieLocale }
        return undefined
      },
      set: vi.fn(),
      delete: vi.fn(),
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
    getSession.mockResolvedValue(null)
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

  describe("session handling", () => {
    it("sets locals.user to null when there is no session", async () => {
      getSession.mockResolvedValue(null)
      const ctx = makeContext({ cookieLocale: "de" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(ctx.locals.session).toBeNull()
    })

    it("sets locals.user and locals.session from a valid session", async () => {
      const user = { id: "1", email: "user@example.com" }
      const session = { id: "sess-1" }
      getSession.mockResolvedValue({ user, session })
      const ctx = makeContext({ cookieLocale: "de" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toEqual(user)
      expect(ctx.locals.session).toEqual(session)
    })

    it("sets locals.user to null when getSession throws", async () => {
      getSession.mockRejectedValue(new Error("network error"))
      const ctx = makeContext({ cookieLocale: "de" })
      await onRequest(ctx, next)
      expect(ctx.locals.user).toBeNull()
      expect(ctx.locals.session).toBeNull()
    })
  })
})
