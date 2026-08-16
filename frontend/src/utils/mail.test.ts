import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ORIGINAL_KEY = process.env.MAILGUN_API_KEY
const ORIGINAL_DOMAIN = process.env.MAILGUN_DOMAIN

async function importMail() {
  vi.resetModules()
  return import("./mail")
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
    const { sendMail } = await importMail()
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })

    expect(fetch).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("student@example.com"))
  })

  it("logs instead of sending when only one of the two env vars is set", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    delete process.env.MAILGUN_DOMAIN
    const { sendMail } = await importMail()
    vi.spyOn(console, "warn").mockImplementation(() => {})

    await sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })

    expect(fetch).not.toHaveBeenCalled()
  })

  it("posts to the Mailgun API with basic auth and form-encoded body when configured", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail } = await importMail()
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never)

    await sendMail({ to: "student@example.com", subject: "Verify your email", text: "Click here" })

    expect(fetch).toHaveBeenCalledWith(
      "https://api.mailgun.net/v3/mail.example.com/messages",
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
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 422 } as never)

    await expect(
      sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })
    ).rejects.toThrow(/422/)
  })

  it("resolves without throwing when the Mailgun API responds with ok", async () => {
    process.env.MAILGUN_API_KEY = "key-123"
    process.env.MAILGUN_DOMAIN = "mail.example.com"
    const { sendMail } = await importMail()
    vi.mocked(fetch).mockResolvedValue({ ok: true } as never)

    await expect(
      sendMail({ to: "student@example.com", subject: "Hi", text: "Body" })
    ).resolves.toBeUndefined()
  })
})
