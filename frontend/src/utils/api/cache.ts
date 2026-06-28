export const CACHE_TTL_MS = 5 * 60 * 1000
const MAX_ENTRIES = 100

const store = new Map<string, { value: unknown; expiresAt: number }>()

export async function withCache<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  const entry = store.get(key)
  if (entry && entry.expiresAt > now) return entry.value as T

  const value = await fn()
  if (store.size >= MAX_ENTRIES) {
    const keyToBeDeleted = store.keys().next().value
    if (keyToBeDeleted) store.delete(keyToBeDeleted)
  }
  store.set(key, { value, expiresAt: now + CACHE_TTL_MS })
  return value
}
