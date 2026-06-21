import { defineMiddleware } from "astro:middleware"
import { STRAPI_URL } from "astro:env/client"
import type { Locale } from "@/i18n/translations"
import { deleteAuthCookies, updateJwtCookie, updateRefreshTokenCookie } from "@/utils/auth-cookies"

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

type JwtResult = { id: number; exp: number } | { expired: true } | null

function decodeJwt(token: string): JwtResult {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const decoded = JSON.parse(Buffer.from(parts[1], "base64url").toString())
    // Support both legacy format (id: number) and refresh-mode format (userId: string)
    const id = typeof decoded.id === "number" ? decoded.id : Number(decoded.userId)
    if (!Number.isInteger(id) || id <= 0) return null
    if (typeof decoded.exp !== "number" || decoded.exp * 1000 < Date.now()) {
      return { expired: true }
    }
    return { id, exp: decoded.exp }
  } catch {
    return null
  }
}

async function tryRefresh(
  context: Parameters<Parameters<typeof defineMiddleware>[0]>[0],
  refreshToken: string
): Promise<boolean> {
  try {
    const res = await fetch(`${STRAPI_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(3000),
    })

    if (res.ok) {
      const data = await res.json()
      const { jwt, refreshToken: newRefreshToken } = data

      if (typeof jwt === "string" && jwt) {
        updateJwtCookie(context.cookies, jwt)
        context.locals.token = jwt

        if (typeof newRefreshToken === "string" && newRefreshToken) {
          updateRefreshTokenCookie(context.cookies, newRefreshToken)
        }

        const verified = decodeJwt(jwt)
        if (verified && !("expired" in verified)) {
          context.locals.user = { id: verified.id }
          return true
        }
      }
    } else if (res.status === 401 || res.status === 403) {
      deleteAuthCookies(context.cookies)
    }
  } catch {
    // Network error — leave cookies intact, user will appear logged out this request only
  }

  context.locals.user = null
  context.locals.token = null
  return false
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
  const refreshToken = context.cookies.get("refresh_token")?.value

  if (token) {
    const verified = decodeJwt(token)

    if (verified && !("expired" in verified)) {
      context.locals.user = { id: verified.id }
      context.locals.token = token
    } else if ((verified === null || "expired" in verified) && refreshToken) {
      await tryRefresh(context, refreshToken)
    } else {
      // Invalid or expired with no refresh token
      deleteAuthCookies(context.cookies)
      context.locals.user = null
      context.locals.token = null
    }
  } else if (refreshToken) {
    await tryRefresh(context, refreshToken)
  } else {
    context.locals.user = null
    context.locals.token = null
  }

  return next()
})
