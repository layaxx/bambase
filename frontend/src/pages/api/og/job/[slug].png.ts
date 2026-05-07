import type { APIRoute } from "astro"
import { fetchJobOffer } from "@/utils/api"
import { makeImageContent, makeJobOfferSubtitleItems } from "@/utils/opengraph/imageContent"
import { renderToPNG } from "@/utils/opengraph/render"

export const GET: APIRoute = async ({ params, redirect }) => {
  const { slug } = params
  if (!slug) return redirect("/og-image.png", 302)

  const { data: job } = await fetchJobOffer(slug)

  if (!job || job.online_status !== "published") return redirect("/og-image.png", 302)

  try {
    const png = await renderToPNG(
      makeImageContent({
        category: "Jobs",
        titleContent: job.title,
        subtitleItems: makeJobOfferSubtitleItems(job),
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
