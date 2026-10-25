import { describe, expect, it } from "vitest"
import { findPage, lastPageRedirect, parsePageParam } from "./pagination"

const page = (value: string) => parsePageParam(new URL(`https://bambase.de/jobs?page=${value}`))

describe("parsePageParam", () => {
  it("reads a valid page", () => {
    expect(page("3")).toBe(3)
  })

  it("falls back to 1 for a missing or bad page", () => {
    expect(parsePageParam(new URL("https://bambase.de/jobs"))).toBe(1)
    expect(page("abc")).toBe(1)
    expect(page("0")).toBe(1)
    expect(page("-2")).toBe(1)
  })

  it("caps a huge page", () => {
    expect(page("9".repeat(400))).toBe(10_000)
    expect(page("100000000000000000000")).toBe(10_000)
  })
})

describe("lastPageRedirect", () => {
  const url = new URL("https://bambase.de/jobs?search=dev&page=9")

  it("stays on a page that exists", () => {
    expect(lastPageRedirect(url, 3, 3)).toBeNull()
  })

  it("goes to the last page and keeps the other params", () => {
    expect(lastPageRedirect(url, 9, 3)).toBe("/jobs?search=dev&page=3")
  })

  it("drops the page param when only one page is left", () => {
    expect(lastPageRedirect(url, 9, 1)).toBe("/jobs?search=dev")
    expect(lastPageRedirect(new URL("https://bambase.de/jobs?page=9"), 9, 1)).toBe("/jobs")
  })
})

describe("findPage", () => {
  it("skips the earlier pages and counts the pages", async () => {
    let window
    const result = await findPage(
      3,
      10,
      async (w) => ((window = w), ["a"]),
      async () => 21
    )
    expect(window).toEqual({ skip: 20, take: 10 })
    expect(result).toEqual({ rows: ["a"], total: 21, page: 3, pageCount: 3 })
  })

  it("reports one page for an empty list", async () => {
    const result = await findPage(
      1,
      10,
      async () => [],
      async () => 0
    )
    expect(result.pageCount).toBe(1)
  })
})
