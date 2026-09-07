import type { APIRoute } from "astro"
import { fetchEvent, fetchJobOffer } from "@/utils/api"
import { renderToPNG } from "@/utils/opengraph/render"
import {
  makeEventSubtitleItems,
  makeImageContent,
  makeJobOfferSubtitleItems,
} from "@/utils/opengraph/imageContent"

type Card = Parameters<typeof makeImageContent>[0]

/** Card content per entity type, or null when there is nothing public to render. */
const CARDS: Record<string, (slug: string) => Promise<Card | null>> = {
  event: async (slug) => {
    const { data: event } = await fetchEvent(slug)
    if (!event) return null
    return {
      category: "Events",
      titleContent: event.title,
      subtitleItems: makeEventSubtitleItems(event),
    }
  },
  job: async (slug) => {
    const { data: job } = await fetchJobOffer(slug)
    if (job?.online_status !== "published") return null
    return {
      category: "Jobs",
      titleContent: job.title,
      subtitleItems: makeJobOfferSubtitleItems(job),
    }
  },
}

export const GET: APIRoute = async ({ params, redirect }) => {
  const { type, slug } = params
  const card = type ? CARDS[type] : undefined
  if (!card || !slug) return redirect("/og-image.png", 302)

  try {
    const content = await card(slug)
    if (!content) return redirect("/og-image.png", 302)

    const png = await renderToPNG(makeImageContent(content))

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
