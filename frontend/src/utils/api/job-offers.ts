import { STRAPI_TOKEN } from "astro:env/server"
import { client } from "./client"
import { STRAPI_URL } from "astro:env/client"

export const JOB_TYPES = [
  "part_time",
  "internship",
  "working_student",
  "research_assistant",
  "thesis",
  "volunteer",
  "other",
] as const

export type JobType = (typeof JOB_TYPES)[number]

export const JOB_FIELDS = [
  "it",
  "marketing",
  "administration",
  "research",
  "gastronomy",
  "retail",
  "education",
  "other",
] as const

export type JobField = (typeof JOB_FIELDS)[number]

export const WORK_MODES = ["on_site", "hybrid", "remote"] as const

export type WorkMode = (typeof WORK_MODES)[number]

export type JobOffer = {
  documentId: string
  slug: string
  title: string
  description: string
  company: string
  location: string
  online_status: "submitted" | "published" | "expired" | "rejected" | "archived"
  working_hours: number
  offline_after?: string
  external_url?: string
  job_type: JobType
  field: JobField
  work_mode: WorkMode
  contact: {
    name?: string
    mail?: string
    phone?: string
  }
  owner?: { id: number }
  reports?: { documentId: string }[]
  createdAt: string
}

export async function fetchJobOffers(limit = 100): Promise<JobOffer[]> {
  try {
    const result = await client.collection("job-offers").find({
      filters: { online_status: { $eq: "published" } },
      sort: ["createdAt:desc"],
      populate: ["contact"],
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as JobOffer[]
  } catch (error) {
    console.error("Error fetching job offers", error)
    return []
  }
}

export async function fetchJobOffer(slug: string, token = STRAPI_TOKEN): Promise<JobOffer | null> {
  try {
    const headers: Record<string, string> = {}
    headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(
      `${STRAPI_URL}/api/job-offers?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[contact]=true&populate[owner]=true&populate[reports][filters][review_status][$ne]=dismissed`,
      {
        headers,
      }
    )

    if (!res.ok) {
      if (res.status === 401 && token !== STRAPI_TOKEN) {
        console.warn("Unauthorized access with provided token, retrying with public token...")
        return fetchJobOffer(slug, STRAPI_TOKEN)
      }
      return null
    }
    const result = await res.json()

    return (result?.data?.[0] ?? null) as unknown as JobOffer | null
  } catch (error) {
    console.error("Error fetching job offer", error)
    return null
  }
}

export async function fetchMyJobOffers(token: string, userId: number): Promise<JobOffer[]> {
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/job-offers?filters[owner][id][$eq]=${userId}&populate[0]=contact&sort=createdAt:desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return []
    const result = await res.json()
    return (result?.data ?? []) as unknown as JobOffer[]
  } catch (error) {
    console.error("Error fetching own job offers", error)
    return []
  }
}
