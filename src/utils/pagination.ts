/** Above this, `skip` grows past what the database accepts. Pages then redirect to their last page,
 * see `lastPageRedirect`. */
const MAX_PAGE = 10_000

/** Reads the 1-based `page` search param. Falls back to 1 if it is missing or not valid. */
export function parsePageParam(url: URL): number {
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10)
  if (Number.isNaN(page) || page < 1) return 1
  return Math.min(page, MAX_PAGE)
}

/**
 * Returns the URL of the last page if `page` lies past it, else null. A filter or an old
 * bookmark can point past the last page of results, which would render an empty list.
 */
export function lastPageRedirect(url: URL, page: number, pageCount: number): string | null {
  if (page <= pageCount) return null
  const params = new URLSearchParams(url.searchParams)
  if (pageCount > 1) params.set("page", String(pageCount))
  else params.delete("page")
  return params.size ? `${url.pathname}?${params}` : url.pathname
}
