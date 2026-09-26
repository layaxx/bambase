import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: CallableFunction) => fn,
}))

const getSession = vi.fn()
vi.mock("./utils/auth", () => ({
  auth: { api: { getSession: (...args: unknown[]) => getSession(...args) } },
}))

import { onRequest } from "./middleware"
import { baseLogger } from "./utils/logger"
import type { APIContext } from "astro"

function makeContext({
  cookieLocale,
  acceptLanguage,
  headers = {},
  method = "GET",
  path = "/events",
}: {
  cookieLocale?: string
  acceptLanguage?: string | null
  headers?: Record<string, string>
  method?: string
  path?: string
}) {
  const allHeaders = new Headers(headers)
  if (acceptLanguage) allHeaders.set("Accept-Language", acceptLanguage)

  return {
    cookies: {
      get: (name: string) => {
        if (name === "locale" && cookieLocale !== undefined) return { value: cookieLocale }
        return undefined
      },
      set: vi.fn(),
      delete: vi.fn(),
    },
    url: new URL(`http://localhost:4321${path}`),
    request: { method, headers: allHeaders },
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

  describe("request correlation", () => {
    it("returns a generated request id in the X-Request-ID response header", async () => {
      const response = await onRequest(makeContext({ cookieLocale: "de" }), next)
      expect(response?.headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/)
    })

    // Astro renders the error page by running the middleware again on the same Request.
    it("keeps the same id when Astro re-enters on the same request", async () => {
      const ctx = makeContext({ cookieLocale: "de" })
      const errorPass = makeContext({ cookieLocale: "de" })
      Object.assign(errorPass, { request: ctx.request })

      const first = await onRequest(ctx, next)
      const second = await onRequest(errorPass, next)

      expect(second?.headers.get("X-Request-ID")).toBe(first?.headers.get("X-Request-ID"))
    })
  })

  describe("request logging", () => {
    afterEach(() => vi.restoreAllMocks())

    it("logs one canonical access log per request", async () => {
      const infoSpy = vi.spyOn(baseLogger, "info").mockImplementation(() => {})
      const ctx = makeContext({
        cookieLocale: "de",
        method: "POST",
        path: "/jobs",
        headers: { "User-Agent": "vitest" },
      })

      await onRequest(ctx, vi.fn().mockResolvedValue(new Response(null, { status: 201 })))

      expect(infoSpy).toHaveBeenCalledTimes(1)
      expect(infoSpy).toHaveBeenCalledWith(
        {
          method: "POST",
          path: "/jobs",
          status: 201,
          durationMs: expect.any(Number),
          userAgent: "vitest",
        },
        "request completed"
      )
    })

    it("binds the caller and names the form action on the access log", async () => {
      const childSpy = vi.spyOn(baseLogger, "child")
      const infoSpy = vi.spyOn(baseLogger, "info").mockImplementation(() => {})
      getSession.mockResolvedValue({ user: { id: "user-1" }, session: { id: "sess-1" } })
      const ctx = makeContext({
        cookieLocale: "de",
        method: "POST",
        path: "/admin/users?_astroAction=users.ban",
      })

      await onRequest(ctx, next)

      expect(childSpy).toHaveBeenCalledWith({ requestId: expect.any(String), userId: "user-1" })
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({ path: "/admin/users", action: "users.ban" }),
        "request completed"
      )
    })

    it("logs a 5xx response as a warning", async () => {
      const warnSpy = vi.spyOn(baseLogger, "warn").mockImplementation(() => {})
      const ctx = makeContext({ cookieLocale: "de" })

      await onRequest(ctx, vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

      expect(warnSpy).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500 }),
        "request completed"
      )
    })

    it("does not log the query string", async () => {
      const infoSpy = vi.spyOn(baseLogger, "info").mockImplementation(() => {})
      const ctx = makeContext({ cookieLocale: "de", path: "/jobs?token=secret-value" })

      await onRequest(ctx, next)

      expect(JSON.stringify(infoSpy.mock.calls)).not.toContain("secret-value")
    })

    it("logs a structured error and rethrows when the request fails", async () => {
      const errorSpy = vi.spyOn(baseLogger, "error").mockImplementation(() => {})
      const ctx = makeContext({ cookieLocale: "de", path: "/boom" })
      const boom = new Error("handler exploded")

      await expect(onRequest(ctx, vi.fn().mockRejectedValue(boom))).rejects.toThrow(boom)

      expect(errorSpy).toHaveBeenCalledWith(
        { err: boom, method: "GET", path: "/boom", durationMs: expect.any(Number) },
        "request failed"
      )
    })

    it("logs a failed session lookup without failing the request", async () => {
      const errorSpy = vi.spyOn(baseLogger, "error").mockImplementation(() => {})
      getSession.mockRejectedValue(new Error("auth down"))
      const ctx = makeContext({ cookieLocale: "de" })

      await onRequest(ctx, next)

      expect(errorSpy).toHaveBeenCalledWith({ err: expect.any(Error) }, "session lookup failed")
    })
  })
})
