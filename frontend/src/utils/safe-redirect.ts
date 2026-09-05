/**
 * Narrows a caller-supplied `?redirect=` value to a path we are willing to send a browser to.
 *
 * Anything that can leave the site is replaced by `fallback`: absolute URLs
 * ("https://bambase.de.evil.example"), protocol-relative ones ("//evil.example") and the
 * backslash variants browsers normalise to them ("/\evil.example"). Without this an ordinary
 * link on the real domain becomes a hop to an attacker's page — most damagingly a clone of
 * /login, since the site already teaches users to follow emailed BamBase links to a login form.
 *
 * `base` is the URL the value arrived on: `Astro.url` on the server, `window.location.href` in
 * the browser. The return value is normalised to path + query + hash, so it is always relative.
 */
export function safeRedirect(
  target: string | null | undefined,
  base: string | URL,
  fallback = "/"
): string {
  if (!target?.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback
  }

  try {
    const url = new URL(target, base)
    if (url.origin !== new URL(base.toString()).origin) {
      return fallback
    }
    return url.pathname + url.search + url.hash
  } catch {
    return fallback
  }
}
