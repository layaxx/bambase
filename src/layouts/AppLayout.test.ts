import { describe, expect, it, beforeAll } from "vitest"
import { experimental_AstroContainer as AstroContainer } from "astro/container"
import AppLayout from "./AppLayout.astro"

let container: AstroContainer

beforeAll(async () => {
  container = await AstroContainer.create()
})

describe("AppLayout", () => {
  it("escapes a user-supplied title in <title>, which astro-seo renders as raw HTML", async () => {
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
})
