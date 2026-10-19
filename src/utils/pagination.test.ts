import { describe, expect, it } from "vitest"
import { parsePageParam } from "./pagination"

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
