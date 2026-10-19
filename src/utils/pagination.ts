/** Above this, `skip` grows past what the database accepts. Pages then redirect to their last page. */
const MAX_PAGE = 10_000

/** Reads the 1-based `page` search param. Falls back to 1 if it is missing or not valid. */
export function parsePageParam(url: URL): number {
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10)
  if (Number.isNaN(page) || page < 1) return 1
  return Math.min(page, MAX_PAGE)
}
