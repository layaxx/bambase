import { STRAPI_TOKEN } from "astro:env/server"
import { client, withTimeout, fetchWithTimeout } from "./client"
import { STRAPI_URL } from "astro:env/client"
import type { ApiResult } from "./types"

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

export async function fetchJobOffers(limit = 100): Promise<ApiResult<JobOffer[]>> {
  try {
    const result = await withTimeout(
      client.collection("job-offers").find({
        filters: { online_status: { $eq: "published" } },
        sort: ["createdAt:desc"],
        populate: ["contact"],
        pagination: { limit },
      })
    )
    return { data: (result.data ?? []) as unknown as JobOffer[], apiDown: false }
  } catch (error) {
    console.error("Error fetching job offers", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchJobOffer(
  slug: string,
  token = STRAPI_TOKEN
): Promise<ApiResult<JobOffer | null>> {
  try {
    const res = await fetchWithTimeout(
      `${STRAPI_URL}/api/job-offers?filters[slug][$eq]=${encodeURIComponent(slug)}&populate[contact]=true&populate[owner][fields][0]=id&populate[reports][filters][review_status][$ne]=dismissed`,
      { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
      if (res.status === 401 && token !== STRAPI_TOKEN) {
        console.warn("Unauthorized access with provided token, retrying with public token...")
        return fetchJobOffer(slug, STRAPI_TOKEN)
      }
      return { data: null, apiDown: false }
    }
    const result = await res.json()
    return { data: (result?.data?.[0] ?? null) as unknown as JobOffer | null, apiDown: false }
  } catch (error) {
    console.error("Error fetching job offer", error)
    return { data: null, apiDown: true }
  }
}

export async function fetchMyJobOffers(
  token: string,
  userId: number
): Promise<ApiResult<JobOffer[]>> {
  try {
    const res = await fetchWithTimeout(
      `${STRAPI_URL}/api/job-offers?filters[owner][id][$eq]=${userId}&populate[0]=contact&sort=createdAt:desc`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      console.warn("Failed to fetch own job offers:", await res.text())
      return { data: [], apiDown: false }
    }
    const result = await res.json()
    return { data: (result?.data ?? []) as unknown as JobOffer[], apiDown: false }
  } catch (error) {
    console.error("Error fetching own job offers", error)
    return { data: [], apiDown: true }
  }
}
