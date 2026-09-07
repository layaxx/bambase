export type ApiResult<T> = { data: T; apiDown: boolean }

/**
 * Runs a query and tags the outcome for the UI: `apiDown` tells a page to render the
 * "data unavailable" banner instead of an empty state, so a failed query never looks
 * like a legitimately empty result. `fallback` is what the page shows meanwhile.
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
