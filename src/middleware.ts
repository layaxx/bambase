import { randomUUID } from "node:crypto"
import { defineMiddleware } from "astro:middleware"
import type { Locale } from "@/i18n/translations"
import { baseLogger, runWithRequestLogger } from "@/utils/logger"
import { auth } from "./utils/auth"
import { registerCronJob } from "@/utils/register-cron-job"
import { syncMensaMeals } from "@/utils/mensa-sync"
import { syncUnivisEvents } from "@/utils/event-sync"
import { syncJobOffers } from "@/utils/job-offer-sync"
import { expireJobOffers } from "@/utils/job-offer-expiry"

registerCronJob("mensa-sync", syncMensaMeals, {
  startupEnvVar: "LOAD_MENSA_ON_STARTUP",
})
registerCronJob("event-sync", syncUnivisEvents, {
  startupEnvVar: "LOAD_EVENTS_ON_STARTUP",
})
registerCronJob("job-offer-sync", syncJobOffers, {
  startupEnvVar: "LOAD_JOB_OFFERS_ON_STARTUP",
})
registerCronJob("job-offer-expiry", expireJobOffers)

/**
 * Astro re-enters this middleware on the *same* Request object to render the error page, so a
 * failing request passes through twice. Without this cache the second pass would mint a fresh
 * id, and the X-Request-ID handed to the client would not be the id on the error log.
 */
const requestIds = new WeakMap<Request, string>()

function resolveRequestId(request: Request): string {
  const requestId = requestIds.get(request) ?? randomUUID()
  requestIds.set(request, requestId)
  return requestId
}

const SUPPORTED_LOCALES: Locale[] = ["de", "en"]
const DEFAULT_LOCALE: Locale = "de"
const COOKIE_NAME = "locale"

function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE

  const parsed = header
    .split(",")
    .map((part) => {
      const [lang, qValue] = part.trim().split(";")
      const q = qValue?.startsWith("q=") ? parseFloat(qValue.slice(2)) : 1
      return {
        lang: lang.toLowerCase().slice(0, 2),
        q,
      }
    })
    .sort((a, b) => b.q - a.q)

  const match = parsed.find((entry) => SUPPORTED_LOCALES.includes(entry.lang as Locale))

  return (match?.lang as Locale) ?? DEFAULT_LOCALE
}

export const onRequest = defineMiddleware(async (context, next) => {
  const startedAt = performance.now()
  const requestId = resolveRequestId(context.request)
  const method = context.request.method
  const path = context.url.pathname
  // Form actions post to the page itself, and the action name travels in the query string,
  // which stays out of the log. The name alone is safe and tells the POSTs apart.
  const action = context.url.searchParams.get("_astroAction") ?? undefined

  const cookieLocaleRaw = context.cookies.get(COOKIE_NAME)?.value?.toLowerCase()
  const cookieLocale = SUPPORTED_LOCALES.includes(cookieLocaleRaw as Locale)
    ? (cookieLocaleRaw as Locale)
    : undefined
  if (cookieLocale) {
    context.locals.locale = cookieLocale
  } else {
    const acceptLanguage = context.request.headers.get("Accept-Language")
    context.locals.locale = parseAcceptLanguage(acceptLanguage)
    context.cookies.set(COOKIE_NAME, context.locals.locale, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
    })
  }

  context.locals.user = null
  context.locals.session = null
  try {
    const session = await auth.api.getSession({ headers: context.request.headers })
    if (session) {
      context.locals.user = session.user
      context.locals.session = session.session
    }
  } catch (err) {
    baseLogger.child({ requestId }).error({ err }, "session lookup failed")
  }

  // Bound after the session lookup, so every line of the request names the caller.
  const userId = context.locals.user?.id
  const log = baseLogger.child(userId ? { requestId, userId } : { requestId })

  return runWithRequestLogger(log, async () => {
    let response: Response
    try {
      response = await next()
    } catch (err) {
      log.error(
        { err, method, path, action, durationMs: Math.round(performance.now() - startedAt) },
        "request failed"
      )
      throw err
    }

    try {
      response.headers.set("X-Request-ID", requestId)
    } catch {
      // Some responses (redirects from Response.redirect) have immutable headers.
      // The id still appears in the log line below.
    }

    // A thrown error was already logged as "request failed", so a 5xx here is only a warning.
    log[response.status >= 500 ? "warn" : "info"](
      {
        method,
        path,
        action,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        userAgent: context.request.headers.get("User-Agent")?.slice(0, 256) ?? undefined,
      },
      "request completed"
    )
    return response
  })
})
