import { defineMiddleware } from "astro:middleware"
import type { Locale } from "@/i18n/translations"

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
export const onRequest = defineMiddleware((context, next) => {
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
  return next()
})
