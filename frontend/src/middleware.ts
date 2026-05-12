import { defineMiddleware } from "astro:middleware"
import { STRAPI_URL } from "astro:env/client"
import type { Locale } from "@/i18n/translations"
import { deleteAuthCookies, updateJwtCookie } from "@/utils/auth-cookies"

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

function getJwtExp(token: string): number | null {
  try {
    const payload = token.split(".")[1]
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString())
    return typeof decoded.exp === "number" ? decoded.exp : null
  } catch {
    return null
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const cookieLocaleRaw = context.cookies.get(COOKIE_NAME)?.value?.toLowerCase()
  const cookieLocale = SUPPORTED_LOCALES.includes(cookieLocaleRaw as Locale)
    ? (cookieLocaleRaw as Locale)
    : undefined
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
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

  const token = context.cookies.get("auth_token")?.value
  if (token) {
    try {
      const res = await fetch(`${STRAPI_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      })
      if (res.ok) {
        const data = await res.json()
        context.locals.user = { id: data.id, email: data.email, createdAt: data.createdAt }

        const exp = getJwtExp(token)
        const oneDayMs = 24 * 60 * 60 * 1000
        if (exp !== null && exp * 1000 - Date.now() < oneDayMs) {
          try {
            const refresh = await fetch(`${STRAPI_URL}/api/auth/refresh`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(3000),
            })
            if (refresh.ok) {
              const { jwt } = await refresh.json()
              updateJwtCookie(context.cookies, jwt)
            }
          } catch {
            // refresh failure is non-fatal; keep the current session
          }
        }
      } else {
        deleteAuthCookies(context.cookies)
        context.locals.user = null
      }
    } catch {
      context.locals.user = null
    }
  } else {
    context.locals.user = null
  }

  return next()
})
