import { describe, expect, it } from "vitest"
import { Writable } from "node:stream"
import pino from "pino"
import { baseLogger, getLogger, loggerOptions, resolveLevel, runWithRequestLogger } from "./logger"

/** A logger with the real production configuration, writing into an array instead of stdout. */
function captureLogger(overrides: pino.LoggerOptions = {}) {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk))
      callback()
    },
  })
  const log = pino({ ...loggerOptions, level: "info", ...overrides }, stream)
  return { log, records: () => lines.map((line) => JSON.parse(line)) }
}

describe("log format", () => {
  it("writes one valid JSON object per line", () => {
    const { log, records } = captureLogger()

    log.info({ userId: "u1" }, "user authenticated")

    expect(records()).toEqual([
      expect.objectContaining({ userId: "u1", msg: "user authenticated" }),
    ])
  })

  it("includes service, environment, version, timestamp and numeric level", () => {
    const { log, records } = captureLogger()

    log.info("request completed")

    const [record] = records()
    expect(record.service).toBe("bambase")
    expect(record.env).toBeTruthy()
    expect(record.version).toMatch(/^\d+\.\d+\.\d+/)
    expect(record.time).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(record.level).toBe(30)
  })

  it("serializes errors with type, message and stack under `err`", () => {
    const { log, records } = captureLogger()

    log.error({ err: new TypeError("boom"), requestId: "r1" }, "request failed")

    const [record] = records()
    expect(record.err.type).toBe("TypeError")
    expect(record.err.message).toBe("boom")
    expect(record.err.stack).toContain("logger.test.ts")
    expect(record.requestId).toBe("r1")
  })

  it("emits no ANSI escape codes", () => {
    const { log, records } = captureLogger()

    log.warn({ provider: "univis" }, "external provider is slow")

    expect(JSON.stringify(records())).not.toContain("\u001b[")
  })
})

describe("redaction", () => {
  it.each([
    ["authorization", { authorization: "Bearer abc" }],
    ["cookie", { cookie: "session=abc" }],
    ["password", { password: "hunter2" }],
    ["accessToken", { accessToken: "abc" }],
    ["refreshToken", { refreshToken: "abc" }],
    ["sessionToken", { sessionToken: "abc" }],
    ["apiKey", { apiKey: "abc" }],
    ["secret", { secret: "abc" }],
    ["BETTER_AUTH_SECRET", { BETTER_AUTH_SECRET: "abc" }],
    ["MAILGUN_API_KEY", { MAILGUN_API_KEY: "abc" }],
    ["DATABASE_URL", { DATABASE_URL: "postgres://user:pw@host/db" }],
  ])("censors a top-level %s field", (field, payload) => {
    const { log, records } = captureLogger()

    log.info(payload, "sensitive")

    expect(records()[0][field]).toBe("[redacted]")
  })

  it("censors sensitive fields nested one level deep", () => {
    const { log, records } = captureLogger()

    log.info({ headers: { authorization: "Bearer abc", cookie: "s=1" } }, "request headers")

    expect(records()[0].headers).toEqual({ authorization: "[redacted]", cookie: "[redacted]" })
  })

  it("leaves non-sensitive fields untouched", () => {
    const { log, records } = captureLogger()

    log.info({ userId: "u1", provider: "univis" }, "user authenticated")

    expect(records()[0]).toMatchObject({ userId: "u1", provider: "univis" })
  })
})

describe("log level", () => {
  it("drops messages below the configured level", () => {
    const { log, records } = captureLogger({ level: "warn" })

    log.info("dropped")
    log.warn("kept")

    expect(records().map((r) => r.msg)).toEqual(["kept"])
  })

  it("is silent under test so the suite stays quiet", () => {
    expect(baseLogger.level).toBe("silent")
  })

  it("accepts a configured level, trimmed", () => {
    expect(resolveLevel("warn", "info")).toBe("warn")
    expect(resolveLevel(" silent ", "info")).toBe("silent")
  })

  it.each([
    ["a misspelled level", "lolwat"],
    ["an empty value, as shipped in .env.example", ""],
    ["nothing at all", undefined],
  ])("falls back to the default given %s", (_case, configured) => {
    expect(resolveLevel(configured, "info")).toBe("info")
  })

  it("never lets an invalid level reach pino, which would throw", () => {
    expect(() => pino({ ...loggerOptions, level: resolveLevel("lolwat", "info") })).not.toThrow()
    expect(() => pino({ ...loggerOptions, level: "lolwat" })).toThrow()
  })
})

describe("request-scoped logger", () => {
  it("falls back to the base logger outside a request", () => {
    expect(getLogger()).toBe(baseLogger)
  })

  it("resolves to the request logger inside runWithRequestLogger", async () => {
    const child = baseLogger.child({ requestId: "req-1" })

    await runWithRequestLogger(child, async () => {
      await Promise.resolve()
      expect(getLogger()).toBe(child)
      expect(getLogger().bindings()).toMatchObject({ requestId: "req-1" })
    })

    expect(getLogger()).toBe(baseLogger)
  })
})
