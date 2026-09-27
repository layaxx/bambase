import { AsyncLocalStorage } from "node:async_hooks"
import { format } from "node:util"
import pino from "pino"
import { version } from "../../package.json"

/**
 * Server-side structured logging.
 *
 * Production emits newline-delimited JSON on stdout/stderr:
 *   Astro/Node -> stdout/stderr -> Docker logging infrastructure -> log aggregation
 * There is deliberately no file destination and no log shipper inside the container.
 *
 * Only import this from server code. It pulls in `node:async_hooks` and pino, neither of
 * which belongs in a client bundle.
 */

function defaultLevel(): string {
  if (import.meta.env.TEST) return "silent"
  return import.meta.env.PROD ? "info" : "debug"
}

/** The levels pino accepts, plus the catch-all that turns logging off entirely. */
const VALID_LEVELS = new Set([...Object.keys(pino.levels.values), "silent"])

/**
 * A misspelled level must not be able to take the server down. pino throws on an unknown level,
 * and because this module is loaded lazily that throw would land on the first request rather
 * than at startup, leaving a process that passes its health check and fails every request.
 * An unset or blank value is normal and simply means "use the default".
 */
export function resolveLevel(configured: string | undefined, fallback: string): string {
  const level = configured?.trim()
  if (!level) return fallback
  return VALID_LEVELS.has(level) ? level : fallback
}

const configuredLevel = process.env.LOG_LEVEL ?? import.meta.env.LOG_LEVEL
const level = resolveLevel(configuredLevel, defaultLevel())
const levelWasRejected = Boolean(configuredLevel?.trim()) && level !== configuredLevel?.trim()

/**
 * Field names that must never reach the log output. Pino replaces them before serializing,
 * so an accidental `log.info({ user })` cannot leak a credential.
 * `*.field` covers one level of nesting, which is as deep as anything worth logging goes.
 */
const REDACTED_PATHS = [
  "password",
  "newPassword",
  "currentPassword",
  "token",
  "accessToken",
  "refreshToken",
  "sessionToken",
  "idToken",
  "apiKey",
  "secret",
  "authorization",
  "cookie",
  "set-cookie",
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "MAILGUN_API_KEY",
  "JOB_OFFER_MIGRATION_COOKIE",
].flatMap((field) => [field, `*.${field}`])

/** Exported so tests can build a logger with the real production configuration. */
export const loggerOptions = {
  level,
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: "bambase", env: import.meta.env.MODE, version },
  redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
} satisfies pino.LoggerOptions

export const baseLogger = pino({
  ...loggerOptions,
  // pino-pretty is a devDependency, so it is only ever referenced outside production.
  transport:
    import.meta.env.PROD || import.meta.env.TEST
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
})

if (levelWasRejected) {
  // Not `level`: pino owns that key, and a second one would make the line ambiguous to parse.
  baseLogger.warn(
    { configured: configuredLevel, fallbackLevel: level },
    "LOG_LEVEL is not a valid level, falling back to the default"
  )
}

const requestLogger = new AsyncLocalStorage<pino.Logger>()

/** Runs `fn` with `log` as the ambient logger for everything it awaits. */
export function runWithRequestLogger<T>(log: pino.Logger, fn: () => T): T {
  return requestLogger.run(log, fn)
}

/**
 * The request-scoped logger, or the base logger outside a request. Call sites get the `requestId`
 * without threading a logger through every signature.
 */
export function getLogger(): pino.Logger {
  return requestLogger.getStore() ?? baseLogger
}

/** SGR escapes, which would otherwise be embedded verbatim in a JSON string. */
// eslint-disable-next-line no-control-regex -- matching the ESC control character is the point
const ANSI_SGR = /\u001B\[[0-9;]*m/g

/**
 * Astro's SSR runtime and Better Auth log straight to `console`, bypassing pino. In production
 * that puts unparseable, ANSI-coloured lines into the JSON stream, so those calls are re-emitted
 * as pino records instead. Development keeps the original output, which reads far better.
 *
 * `console` is only ever the last line of defence: it carries a preformatted string, so pino's
 * redaction cannot reach inside it. Application code must keep using `getLogger()` directly.
 */
function captureConsole(): void {
  const forward =
    (level: "debug" | "info" | "warn" | "error") =>
    (...args: unknown[]) => {
      getLogger()[level]({ source: "console" }, format(...args).replace(ANSI_SGR, ""))
    }

  /* eslint-disable no-console -- replacing the globals is this function's whole purpose */
  console.debug = forward("debug")
  console.log = forward("info")
  console.info = forward("info")
  console.warn = forward("warn")
  console.error = forward("error")
  /* eslint-enable no-console */
}

function logCrashes(): void {
  // A monitor observes without handling, so Node still crashes. It also fires for unhandled
  // rejections, with origin "unhandledRejection". An "unhandledRejection" listener would suppress
  // the crash.
  process.on("uncaughtExceptionMonitor", (err, origin) => {
    baseLogger.fatal({ err, origin }, "process crashed")
  })
}

if (import.meta.env.PROD) {
  captureConsole()
  logCrashes()
}
