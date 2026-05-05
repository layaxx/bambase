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

import { jobs } from "./jobs"
import { getFetchBody, makeCookies } from "./test-helpers"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const baseInput = {
  documentId: "doc-123",
  title: "Developer",
  company: "ACME",
  location: "Remote",
  working_hours: 20,
  description: "Build things",
  job_type: "other",
  field: "it",
  work_mode: "on_site",
}

describe("jobs.delete", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      jobs.delete(
        { documentId: "doc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends DELETE to the correct endpoint URL", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await jobs.delete(
      { documentId: "doc-abc" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/job-offers/doc-abc",
      expect.objectContaining({ method: "DELETE" })
    )
  })

  it("includes the Authorization header", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await jobs.delete(
      { documentId: "doc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("my-token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer my-token" }),
      })
    )
  })

  it("throws FORBIDDEN when the API returns a non-ok response", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      jobs.delete(
        { documentId: "doc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("returns {} on success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const result = await jobs.delete(
      { documentId: "doc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )
    expect(result).toEqual({})
  })
})

describe("jobs.archive", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      jobs.archive(
        { documentId: "doc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends PUT to the correct endpoint URL", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await jobs.archive(
      { documentId: "doc-abc" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/job-offers/doc-abc",
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("sends { data: { online_status: 'archived' } } in the body", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    await jobs.archive(
      { documentId: "doc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody()
    expect(body).toEqual({ data: { online_status: "archived" } })
  })

  it("throws FORBIDDEN when the API rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      jobs.archive(
        { documentId: "doc-1" },
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" })
  })

  it("returns {} on success", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true } as Response)

    const result = await jobs.archive(
      { documentId: "doc-1" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )
    expect(result).toEqual({})
  })
})

describe("jobs.update", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      jobs.update(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends PUT to the correct documentId URL", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "some-slug" } }),
    } as Response)

    await jobs.update(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/job-offers/doc-123",
      expect.objectContaining({ method: "PUT" })
    )
  })

  it("returns the slug from the response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "returned-slug" } }),
    } as Response)

    const result = await jobs.update(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(result).toEqual({ slug: "returned-slug" })
  })

  it("throws BAD_REQUEST when the API returns an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      jobs.update(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("includes contact fields in the request body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "u" } }),
    } as Response)

    await jobs.update(
      { ...baseInput, contact_name: "HR", contact_mail: "hr@acme.com", contact_phone: "+49123" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody()
    expect(body.data.contact).toMatchObject({ name: "HR", mail: "hr@acme.com", phone: "+49123" })
  })

  it("omits external_url from the body when not provided", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "u" } }),
    } as Response)

    await jobs.update(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody()
    expect(body.data.external_url).toBeUndefined()
  })
})

describe("jobs.create", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()))

  it("throws UNAUTHORIZED when no token cookie", async () => {
    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies() }
      )
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  it("sends POST to /api/job-offers", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "new-slug" } }),
    } as Response)

    await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:1337/api/job-offers",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("returns the slug from the response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "created-slug" } }),
    } as Response)

    const result = await jobs.create(
      baseInput,
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    expect(result).toEqual({ slug: "created-slug" })
  })

  it("throws BAD_REQUEST when the API returns an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: {} }),
    } as Response)

    await expect(
      jobs.create(
        baseInput,
        // @ts-expect-error - needed because of mocked defineAction function
        { cookies: makeCookies("token") }
      )
    ).rejects.toMatchObject({ code: "BAD_REQUEST" })
  })

  it("includes job_type, field, and work_mode in the body", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { slug: "u" } }),
    } as Response)

    await jobs.create(
      { ...baseInput, job_type: "internship", field: "it", work_mode: "remote" },
      // @ts-expect-error - needed because of mocked defineAction function
      { cookies: makeCookies("token") }
    )

    const body = getFetchBody()
    expect(body.data).toMatchObject({ job_type: "internship", field: "it", work_mode: "remote" })
  })
})
