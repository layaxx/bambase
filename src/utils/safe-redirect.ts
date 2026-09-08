/**
 * Limits a caller-supplied `?redirect=` value to a path to which we send a browser safely.
 *
 * `fallback` replaces each value that can leave the site: an absolute URL
 * ("https://bambase.de.evil.example"), a protocol-relative URL ("//evil.example") and the
 * backslash forms that browsers change into them ("/\evil.example"). Without this check, a
 * usual link on the real domain becomes a step to the page of an attacker. A copy of /login
 * is the most dangerous of these pages, because users already follow BamBase links from an
 * email to a login form.
 *
 * `base` is the URL on which the value came in: `Astro.url` on the server and
 * `window.location.href` in the browser. The result contains only the path, the query and the
 * hash, thus it is always relative.
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
