import type { APIRoute } from "astro"
import { fetchEvent } from "@/utils/api"
import { renderToPNG } from "@/utils/opengraph/render"
import { makeEventSubtitleItems, makeImageContent } from "@/utils/opengraph/imageContent"

export const GET: APIRoute = async ({ params, redirect }) => {
  const { slug } = params
  if (!slug) return redirect("/og-image.png", 302)

  const event = await fetchEvent(slug).catch(() => null)
  if (!event) return redirect("/og-image.png", 302)

  try {
    const png = await renderToPNG(
      makeImageContent({
        category: "Events",
        titleContent: event.title,
        subtitleItems: makeEventSubtitleItems(event),
      })
    )

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    })
  } catch (error) {
    console.error("Error generating OG image:", error)
    return redirect("/og-image.png", 302)
  }
}
