import { describe, expect, it } from "vitest"
import { safeRedirect } from "./safe-redirect"

const BASE = "https://bambase.de/set-locale?lang=de"

describe("safeRedirect", () => {
  it("keeps a relative path", () => {
    expect(safeRedirect("/jobs", BASE)).toBe("/jobs")
  })

  it("keeps query and hash", () => {
    expect(safeRedirect("/jobs?field=it&page=2#list", BASE)).toBe("/jobs?field=it&page=2#list")
  })

  it("falls back when no target is given", () => {
    expect(safeRedirect(null, BASE)).toBe("/")
    expect(safeRedirect(undefined, BASE)).toBe("/")
    expect(safeRedirect("", BASE)).toBe("/")
  })

  it("returns the given fallback instead of the default", () => {
    expect(safeRedirect("https://evil.example", BASE, "/login")).toBe("/login")
  })

  it.each([
    ["absolute https URL", "https://bambase.de.evil.example/login"],
    ["absolute http URL", "http://evil.example"],
    ["protocol-relative URL", "//evil.example/login"],
    ["backslash-escaped protocol-relative URL", "/\\evil.example/login"],
    ["backslash-escaped URL", "/\\/evil.example"],
    ["javascript: URL", "javascript:alert(1)"],
    ["data: URL", "data:text/html,<h1>hi</h1>"],
    ["leading whitespace before a protocol-relative URL", " //evil.example"],
    ["a path-less relative value", "jobs"],
  ])("rejects an %s", (_label, target) => {
    expect(safeRedirect(target, BASE)).toBe("/")
  })

  it("rejects a same-origin-looking URL on another host", () => {
    expect(safeRedirect("https://bambase.de@evil.example/login", BASE)).toBe("/")
  })

  it("normalises traversal that stays on the site", () => {
    expect(safeRedirect("/account/../jobs", BASE)).toBe("/jobs")
  })

  it("accepts a URL object as the base", () => {
    expect(safeRedirect("/jobs", new URL(BASE))).toBe("/jobs")
  })
})
