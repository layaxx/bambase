/**
 * Integration tests for the token-refresh pipeline.
 *
 * These tests run the real middleware and real action handler against a shared
 * Astro context object, verifying that the two layers compose correctly when a
 * token refresh occurs mid-session.  The unit tests in src/middleware.test.ts
 * and src/actions/*.test.ts each cover their own layer in isolation; the value
 * here is the cross-layer assertion: locals.token written by middleware is the
 * token the action handler actually uses in its Authorization header.
 *
 * Key regression guard: before fixing the action handlers, they called
 * context.cookies.get("auth_token") which, per Astro's request/response cookie
 * split, always returns the *original request* cookie — never the rotated JWT
 * that middleware wrote via cookies.set().  A test here would have caught that.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vi.mock calls are hoisted by vitest to the top of the module.
vi.mock("astro:env/client", () => ({ STRAPI_URL: "http://strapi.test" }))
vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: CallableFunction) => fn,
}))
vi.mock("astro:actions", () => ({
  defineAction: ({ handler }: { handler: CallableFunction }) => handler,
  ActionError: class extends Error {
    code: string
    constructor({ code, message }: { code: string; message: string }) {
      super(message)
      this.code = code
    }
  },
}))
vi.mock("astro/zod", async () => await import("zod"))
vi.mock("@/utils/api/events", () => ({
  EVENT_CATEGORIES: ["university", "sport", "party", "culture", "social", "other"] as const,
}))
// @/utils/auth-cookies is intentionally NOT mocked so the real cookie helpers
// (updateJwtCookie, deleteAuthCookies, etc.) run and interact with the context.

import { onRequest } from "@/middleware"
import { events } from "@/actions/events"
import type { APIContext } from "astro"

// ─── Token helpers ────────────────────────────────────────────────────────────

function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${header}.${body}.fake-sig`
}

const futureExp = (seconds: number) => Math.floor(Date.now() / 1000) + seconds
const pastExp = (seconds: number) => Math.floor(Date.now() / 1000) - seconds

// ─── Shared context factory ───────────────────────────────────────────────────

/**
 * Creates a context object that is passed to BOTH middleware and the action
 * handler, exactly as Astro does in a real SSR request.
 *
 * The cookie model mirrors Astro's actual request/response split:
 *   cookies.get()    → reads from the immutable incoming request cookies
 *   cookies.set()    → records a Set-Cookie write (does NOT affect get())
 *   cookies.delete() → records a cookie deletion
 *
 * This means that after middleware calls cookies.set("auth_token", newJwt),
 * a subsequent cookies.get("auth_token") still returns the original expired
 * token.  locals.token is the only reliable way to pass the new JWT to action
 * handlers within the same request — which is exactly what our fix does.
 */
function makePipelineContext({
  authToken,
  refreshToken,
}: {
  authToken?: string
  refreshToken?: string
} = {}) {
  const setCookieCalls: Array<[string, string]> = []
  const deletedCookies: string[] = []

  const ctx = {
    cookies: {
      get: (name: string) => {
        if (name === "auth_token" && authToken !== undefined) return { value: authToken }
        if (name === "refresh_token" && refreshToken !== undefined) return { value: refreshToken }
        return undefined
      },
      set: vi.fn((...args: [string, string]) => setCookieCalls.push(args)),
      delete: vi.fn((name: string) => deletedCookies.push(name)),
    },
    locals: {} as Record<string, unknown>,
    request: { headers: { get: () => null } },
    url: { pathname: "/account" },
    // Exposed for assertions
    _setCookieCalls: setCookieCalls,
    _deletedCookies: deletedCookies,
  }
  return ctx as unknown as APIContext & {
    _setCookieCalls: typeof setCookieCalls
    _deletedCookies: typeof deletedCookies
  }
}

const next = vi.fn().mockResolvedValue(new Response())

// Minimal valid input for events.create (schema validation is bypassed by the
// defineAction mock, so only fields the handler actually reads are required).
const sampleEventInput = {
  title: "Test Event",
  organizer: "Test Org",
  description: "A description",
  start: "2026-08-01T10:00:00Z",
  end: "2026-08-01T12:00:00Z",
  category: "other",
  location_type: "none" as const,
}

describe("token-refresh pipeline: middleware → action handler", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.restoreAllMocks())

  // ─── Core regression: the cross-layer token hand-off ───────────────────────

  describe("expired JWT + valid refresh_token", () => {
    it("action handler uses the NEW JWT, not the expired request cookie", async () => {
      const expiredJwt = makeToken({ id: 1, exp: pastExp(60) })
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })

      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          // Call 1: middleware → /api/auth/refresh
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "new-rt" }), {
              status: 200,
            })
          )
          // Call 2: events action → /api/events POST
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ data: { slug: "test-event" } }), { status: 200 })
          )
      )

      const ctx = makePipelineContext({ authToken: expiredJwt, refreshToken: "old-rt" })

      // Middleware runs first and performs a token refresh.
      await onRequest(ctx, next)
      expect(ctx.locals.token).toBe(freshJwt)

      // Action handler runs with the SAME context — this is what Astro does.
      await events.create(sampleEventInput, ctx)

      // The Strapi events API call must use the FRESH JWT.
      const eventsCall = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => String(url).includes("/api/events"))
      expect(eventsCall).toBeDefined()
      const authHeader = (eventsCall?.[1]?.headers as Record<string, string>)?.Authorization
      expect(authHeader).toBe(`Bearer ${freshJwt}`)
      expect(authHeader).not.toContain(expiredJwt)
    })

    it("writes the new auth_token to Set-Cookie", async () => {
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "new-rt" }), { status: 200 })
          )
      )

      const ctx = makePipelineContext({
        authToken: makeToken({ id: 1, exp: pastExp(60) }),
        refreshToken: "old-rt",
      })
      await onRequest(ctx, next)

      const authTokenWrite = ctx._setCookieCalls.find(([name]) => name === "auth_token")
      expect(authTokenWrite).toBeDefined()
      expect(authTokenWrite?.[1]).toBe(freshJwt)
    })

    it("writes the rotated refresh_token to Set-Cookie", async () => {
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(
          new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "rotated-rt" }), {
            status: 200,
          })
        )
      )

      const ctx = makePipelineContext({
        authToken: makeToken({ id: 1, exp: pastExp(60) }),
        refreshToken: "old-rt",
      })
      await onRequest(ctx, next)

      const rtWrite = ctx._setCookieCalls.find(([name]) => name === "refresh_token")
      expect(rtWrite?.[1]).toBe("rotated-rt")
    })
  })

  // ─── Malformed auth_token + valid refresh_token (middleware bug-fix guard) ─

  describe("malformed auth_token + valid refresh_token", () => {
    it("attempts a refresh instead of deleting cookies", async () => {
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "new-rt" }), { status: 200 })
        )
      vi.stubGlobal("fetch", fetchMock)

      const ctx = makePipelineContext({
        authToken: "not.a.valid.jwt.at.all",
        refreshToken: "still-valid-rt",
      })
      await onRequest(ctx, next)

      // Refresh endpoint was called, not skipped.
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/refresh"),
        expect.objectContaining({ method: "POST" })
      )
      // Cookies were NOT deleted (auth persisted via refresh).
      expect(ctx._deletedCookies).not.toContain("auth_token")
      // User is authenticated.
      expect(ctx.locals.user).toEqual({ id: 1 })
    })

    it("action handler is authorized after refresh from malformed token", async () => {
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "new-rt" }), {
              status: 200,
            })
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ data: { slug: "ok" } }), { status: 200 })
          )
      )

      const ctx = makePipelineContext({
        authToken: "garbage",
        refreshToken: "still-valid-rt",
      })
      await onRequest(ctx, next)

      // Should not throw — token is available via locals.
      await expect(events.create(sampleEventInput, ctx)).resolves.toEqual({ slug: "ok" })
    })
  })

  // ─── Valid JWT — no network call ───────────────────────────────────────────

  describe("valid (non-expired) JWT", () => {
    it("makes no network call and passes the JWT straight to the action", async () => {
      const validJwt = makeToken({ id: 1, exp: futureExp(900) })
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ data: { slug: "ok" } }), { status: 200 })
        )
      vi.stubGlobal("fetch", fetchMock)

      const ctx = makePipelineContext({ authToken: validJwt })
      await onRequest(ctx, next)

      // Action handler run.
      await events.create(sampleEventInput, ctx)

      // Only one fetch call — the action's /api/events POST.  No refresh call.
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/refresh"),
        expect.anything()
      )

      const eventsCall = fetchMock.mock.calls[0]
      const authHeader = (eventsCall[1]?.headers as Record<string, string>)?.Authorization
      expect(authHeader).toBe(`Bearer ${validJwt}`)
    })
  })

  // ─── No tokens — action must reject ───────────────────────────────────────

  describe("no auth cookies at all", () => {
    it("action handler throws UNAUTHORIZED", async () => {
      vi.stubGlobal("fetch", vi.fn())

      const ctx = makePipelineContext()
      await onRequest(ctx, next)

      expect(ctx.locals.user).toBeNull()
      expect(ctx.locals.token).toBeNull()

      await expect(events.create(sampleEventInput, ctx)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })
  })

  // ─── Refresh endpoint returns 401 ─────────────────────────────────────────

  describe("refresh_token is expired/revoked", () => {
    it("deletes all auth cookies and action handler throws UNAUTHORIZED", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })))

      const ctx = makePipelineContext({
        authToken: makeToken({ id: 1, exp: pastExp(60) }),
        refreshToken: "revoked-rt",
      })
      await onRequest(ctx, next)

      expect(ctx.locals.user).toBeNull()
      expect(ctx.locals.token).toBeNull()
      expect(ctx._deletedCookies).toContain("auth_token")
      expect(ctx._deletedCookies).toContain("refresh_token")

      await expect(events.create(sampleEventInput, ctx)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })
  })

  // ─── refresh_token only (no auth_token cookie) ────────────────────────────

  describe("refresh_token present but no auth_token cookie", () => {
    it("triggers a refresh and authorizes the action", async () => {
      const freshJwt = makeToken({ id: 1, exp: futureExp(900) })
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ jwt: freshJwt, refreshToken: "new-rt" }), {
              status: 200,
            })
          )
          .mockResolvedValueOnce(
            new Response(JSON.stringify({ data: { slug: "ok" } }), { status: 200 })
          )
      )

      const ctx = makePipelineContext({ refreshToken: "orphaned-rt" })
      await onRequest(ctx, next)

      expect(ctx.locals.user).toEqual({ id: 1 })
      expect(ctx.locals.token).toBe(freshJwt)

      await expect(events.create(sampleEventInput, ctx)).resolves.toEqual({ slug: "ok" })
    })
  })

  // ─── Strapi unreachable during refresh ────────────────────────────────────

  describe("network error during refresh", () => {
    it("does not delete cookies and action throws UNAUTHORIZED for this request only", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("ECONNREFUSED")))

      const ctx = makePipelineContext({
        authToken: makeToken({ id: 1, exp: pastExp(60) }),
        refreshToken: "valid-rt",
      })
      await onRequest(ctx, next)

      // User appears logged out for this request...
      expect(ctx.locals.user).toBeNull()
      // ...but cookies are preserved so the next request can retry.
      expect(ctx._deletedCookies).not.toContain("refresh_token")
      expect(ctx._deletedCookies).not.toContain("auth_token")

      await expect(events.create(sampleEventInput, ctx)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      })
    })
  })
})
