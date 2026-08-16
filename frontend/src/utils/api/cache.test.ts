import { afterEach, describe, expect, it, vi } from "vitest"

async function importCache() {
  vi.resetModules()
  return import("./cache")
}

afterEach(() => {
  vi.useRealTimers()
})

describe("withCache", () => {
  it("calls fn and returns its value on a cache miss", async () => {
    const { withCache } = await importCache()
    const fn = vi.fn().mockResolvedValue("value-1")

    const result = await withCache("key-1", fn)

    expect(result).toBe("value-1")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("returns the cached value without calling fn again within the TTL", async () => {
    const { withCache } = await importCache()
    const fn = vi.fn().mockResolvedValue("value-1")

    await withCache("key-1", fn)
    const result = await withCache("key-1", fn)

    expect(result).toBe("value-1")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("calls fn again once the TTL has expired", async () => {
    vi.useFakeTimers()
    const { withCache, CACHE_TTL_MS } = await importCache()
    const fn = vi.fn().mockResolvedValueOnce("value-1").mockResolvedValueOnce("value-2")

    await withCache("key-1", fn)
    vi.advanceTimersByTime(CACHE_TTL_MS + 1)
    const result = await withCache("key-1", fn)

    expect(result).toBe("value-2")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("caches distinct values under different keys independently", async () => {
    const { withCache } = await importCache()
    const fnA = vi.fn().mockResolvedValue("a")
    const fnB = vi.fn().mockResolvedValue("b")

    expect(await withCache("key-a", fnA)).toBe("a")
    expect(await withCache("key-b", fnB)).toBe("b")
    expect(await withCache("key-a", fnA)).toBe("a")

    expect(fnA).toHaveBeenCalledTimes(1)
    expect(fnB).toHaveBeenCalledTimes(1)
  })

  it("evicts the oldest entry once the cache reaches its max size of 100", async () => {
    const { withCache } = await importCache()

    for (let i = 0; i < 100; i++) {
      // eslint-disable-next-line no-await-in-loop -- filling the cache sequentially so insertion order is deterministic
      await withCache(`key-${i}`, () => Promise.resolve(i))
    }
    await withCache("key-100", () => Promise.resolve(100))

    const fn0 = vi.fn().mockResolvedValue("recomputed")
    const result = await withCache("key-0", fn0)

    expect(result).toBe("recomputed")
    expect(fn0).toHaveBeenCalledTimes(1)
  })
})

describe("invalidateCacheByPrefix", () => {
  it("removes only entries whose key starts with the given prefix", async () => {
    const { withCache, invalidateCacheByPrefix } = await importCache()
    const fnMatch = vi.fn().mockResolvedValue("match")
    const fnOther = vi.fn().mockResolvedValue("other")

    await withCache("job-offers:list", fnMatch)
    await withCache("events:list", fnOther)

    invalidateCacheByPrefix("job-offers:")

    await withCache("job-offers:list", fnMatch)
    await withCache("events:list", fnOther)

    expect(fnMatch).toHaveBeenCalledTimes(2)
    expect(fnOther).toHaveBeenCalledTimes(1)
  })

  it("does nothing when no keys match the prefix", async () => {
    const { withCache, invalidateCacheByPrefix } = await importCache()
    const fn = vi.fn().mockResolvedValue("value")

    await withCache("events:list", fn)
    invalidateCacheByPrefix("job-offers:")
    await withCache("events:list", fn)

    expect(fn).toHaveBeenCalledTimes(1)
  })
})
