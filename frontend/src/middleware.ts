import { defineMiddleware } from "astro:middleware"
import type { Locale } from "./i18n/translations"

const SUPPORTED_LOCALES: Locale[] = ["de", "en"]
const DEFAULT_LOCALE: Locale = "de"
const COOKIE_NAME = "locale"

function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE
  // Parse e.g. "en-US,en;q=0.9,de;q=0.8" → pick first supported locale
  const preferred = header
    .split(",")
    .map((part) => part.trim().split(";")[0].trim().toLowerCase().slice(0, 2))
    .find((lang) => SUPPORTED_LOCALES.includes(lang as Locale))
  return (preferred as Locale) ?? DEFAULT_LOCALE
}

export const onRequest = defineMiddleware((context, next) => {
  const cookieLocale = context.cookies.get(COOKIE_NAME)?.value as Locale | undefined
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    context.locals.locale = cookieLocale
  } else {
    const acceptLanguage = context.request.headers.get("Accept-Language")
    context.locals.locale = parseAcceptLanguage(acceptLanguage)
  }
  return next()
})
