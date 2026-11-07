import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import AppLayout from "./AppLayout.astro"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

describe("AppLayout", () => {
  it("escapes a user-supplied title in <title>", async () => {
    const html = await container.renderToString(AppLayout, {
      props: { title: "</title><script>alert(1)</script>" },
      locals: { locale: "de", user: null, session: null },
      request: new Request("https://bambase.test/job/x"),
    })

    // og:title carries the raw text too, but inside a quoted attribute it is inert.
    expect(html.match(/<title>(.*?)<\/title>/)?.[1]).toBe(
      "&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt; – BamBase.de"
    )
  })

  it("keeps only page 2+ in the canonical URL and title", async () => {
    const render = (url: string) =>
      container.renderToString(AppLayout, {
        props: { title: "Jobs" },
        locals: { locale: "de", user: null, session: null },
        request: new Request(url),
      })
    const canonical = (html: string) => html.match(/<link href="([^"]*)" rel="canonical"/)?.[1]
    const title = (html: string) => html.match(/<title>(.*?)<\/title>/)?.[1]

    const page2 = await render("https://bambase.test/jobs?type=internship&page=2&search=x")
    expect(canonical(page2)).toBe("https://bambase.test/jobs?page=2")
    expect(title(page2)).toBe("Jobs – Seite 2 – BamBase.de")

    const page1 = await render("https://bambase.test/jobs?page=1&type=internship")
    expect(canonical(page1)).toBe("https://bambase.test/jobs")
    expect(title(page1)).toBe("Jobs – BamBase.de")
  })
})
