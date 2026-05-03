import type { APIRoute } from "astro"
import { fetchAllPublishedEventSlugs } from "@/utils/api/events"
import { fetchJobOffers } from "@/utils/api/job-offers"

const STATIC_PATHS = ["/", "/events", "/jobs", "/map", "/mensa", "/about", "/impressum", "/privacy"]

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function urlEntry(loc: string): string {
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`
}

export const GET: APIRoute = async ({ url }) => {
  const origin = url.origin

  const [eventSlugs, jobOffers] = await Promise.all([
    fetchAllPublishedEventSlugs(),
    fetchJobOffers(500),
  ])

  const entries = [
    ...STATIC_PATHS.map((path) => urlEntry(`${origin}${path}`)),
    ...eventSlugs.map((slug) => urlEntry(`${origin}/event/${encodeURIComponent(slug)}`)),
    ...jobOffers.map((job) => urlEntry(`${origin}/job/${encodeURIComponent(job.uuid)}`)),
  ]

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
  ].join("\n")

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=600, stale-while-revalidate=3600",
    },
  })
}
