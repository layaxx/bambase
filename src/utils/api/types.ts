export type ApiResult<T> = { data: T; apiDown: boolean }

/**
 * Runs a query and marks the result for the UI. `apiDown` tells a page to show the
 * "data unavailable" banner and not an empty state, thus a failed query never looks like a
 * correct empty result. The page shows `fallback` while the query is not available.
 */
export async function apiResult<T>(
  errorLabel: string,
  fallback: T,
  load: () => Promise<T>
): Promise<ApiResult<T>> {
  try {
    return { data: await load(), apiDown: false }
  } catch (error) {
    console.error(errorLabel, error)
    return { data: fallback, apiDown: true }
  }
}
