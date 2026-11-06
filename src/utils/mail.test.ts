import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_KEY = process.env.MAILGUN_API_KEY
const ORIGINAL_DOMAIN = process.env.MAILGUN_DOMAIN

async function importMail() {
  vi.resetModules()
  // mail.ts pulls in its own fresh logger module after the reset, so tests must spy on that one.
  const [mail, { baseLogger }] = await Promise.all([import("./mail"), import("./logger")])
  return { ...mail, baseLogger }
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn())
})

afterEach(() => {
  process.env.MAILGUN_API_KEY = ORIGINAL_KEY
  process.env.MAILGUN_DOMAIN = ORIGINAL_DOMAIN
  vi.unstubAllGlobals()
})

describe("sendMail", () => {
  it("logs the message instead of sending when Mailgun is not configured", async () => {
    delete process.env.MAILGUN_API_KEY
    delete process.env.MAILGUN_DOMAIN
    const { sendMail, baseLogger } = await importMail()
    const warnSpy = vi.spyOn(baseLogger, "warn").mockImplementation(() => {})

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })

    expect(fetch).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      { to: "student@example.com", subject: "Hi" },
      "mailgun not configured, email not sent"
    )
  })

  it("logs instead of sending when only one of the two env vars is set", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    delete process.env.MAILGUN_DOMAIN
    const { sendMail, baseLogger } = await importMail()
    vi.spyOn(baseLogger, "warn").mockImplementation(() => {})

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })

    expect(fetch).not.toHaveBeenCalled()
  })

  it("posts to the Mailgun API with basic auth and form-encoded body when configured", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail } = await importMail()
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "<msg-1@mailgun>" }))

    await sendMail({ to: "student@example.com", subject: "Verify your email", text: "Click here" })

    expect(fetch).toHaveBeenCalledWith(
      "https://api.eu.mailgun.net/v3/mail.example.com/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from("api:key-123").toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })
    )

    const [, options] = vi.mocked(fetch).mock.calls[0]
    const body = options?.body as URLSearchParams
    expect(body.get("from")).toBe("BamBase <no-reply@mail.example.com>")
    expect(body.get("to")).toBe("student@example.com")
    expect(body.get("subject")).toBe("Verify your email")
    expect(body.get("text")).toBe("Click here")
  })

  it("throws when the Mailgun API responds with a non-ok status", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail } = await importMail()
    vi.mocked(fetch).mockResolvedValue(new Response("Domain not found", { status: 422 }))

    await expect(
      sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })
    ).rejects.toThrow(/422: Domain not found/)
  })

  it("logs Mailgun's reason when sending fails, without the recipient", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail, baseLogger } = await importMail()
    const errorSpy = vi.spyOn(baseLogger, "error").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue(new Response("Domain not found", { status: 422 }))

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" }).catch(() => {})

    expect(errorSpy).toHaveBeenCalledWith(
      { subject: "Hi", status: 422, reason: "Domain not found" },
      "email send failed"
    )
  })

  it("logs the Mailgun message id on success, without the recipient", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail, baseLogger } = await importMail()
    const infoSpy = vi.spyOn(baseLogger, "info").mockImplementation(() => {})
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "<msg-1@mailgun>" }))

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })

    expect(infoSpy).toHaveBeenCalledWith(
      { subject: "Hi", mailgunId: "<msg-1@mailgun>" },
      "email sent"
    )
  })

  it("resolves without throwing when the Mailgun API responds with ok", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail } = await importMail()
    vi.mocked(fetch).mockResolvedValue(Response.json({ id: "<msg-1@mailgun>" }))

    await expect(
      sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })
    ).resolves.toBeUndefined()
  })
})

describe("checkMailgun", () => {
  beforeEach(() => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
  })

  it("reports not configured without calling Mailgun", async () => {
    delete process.env.MAILGUN_API_KEY
    const { checkMailgun } = await importMail()
    expect(await checkMailgun()).toEqual({ configured: false, ok: false })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("is ok only for an active domain", async () => {
    const { checkMailgun } = await importMail()
    vi.mocked(fetch).mockResolvedValue(Response.json({ domain: { state: "unverified" } }))
    expect(await checkMailgun()).toEqual({ configured: true, ok: false, detail: "unverified" })
    expect(fetch).toHaveBeenCalledWith(
      "https://api.eu.mailgun.net/v3/domains/mail.example.com",
      expect.anything()
    )
  })

  it("reports a rejected key", async () => {
    const { checkMailgun } = await importMail()
    vi.mocked(fetch).mockResolvedValue(new Response("Forbidden", { status: 401 }))
    expect(await checkMailgun()).toEqual({ configured: true, ok: false, detail: "HTTP 401" })
  })

  it("reports unknown when Mailgun does not answer", async () => {
    const { checkMailgun, baseLogger } = await importMail()
    vi.spyOn(baseLogger, "warn").mockImplementation(() => {})
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"))
    expect(await checkMailgun()).toEqual({ configured: true, ok: null, detail: "unreachable" })
  })

  it("calls Mailgun at most once per 5 minutes", async () => {
    vi.useFakeTimers({ now: new Date("2026-04-15T12:00:00Z") })
    const { checkMailgun } = await importMail()
    vi.mocked(fetch).mockImplementation(async () => Response.json({ domain: { state: "active" } }))

    await Promise.all([checkMailgun(), checkMailgun()])
    vi.setSystemTime(Date.now() + 4 * 60 * 1000)
    expect(await checkMailgun()).toEqual({ configured: true, ok: true, detail: "active" })
    expect(fetch).toHaveBeenCalledTimes(1)

    vi.setSystemTime(Date.now() + 2 * 60 * 1000)
    await checkMailgun()
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
