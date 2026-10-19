import { describe, expect, it } from "vitest"
import { lastPageRedirect, parsePageParam } from "./pagination"

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
