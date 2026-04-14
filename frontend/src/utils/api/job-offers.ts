import { client, strapiUrl } from "./client"

export type JobOffer = {
  documentId: string
  uuid: string
  title: string
  description: string
  company: string
  location: string
  online_status: "submitted" | "published" | "expired" | "rejected" | "archived"
  working_hours: number
  offline_after?: string
  external_url?: string
  contact: {
    name?: string
    mail?: string
    phone?: string
  }
  owner?: { id: number }
}

export async function fetchJobOffers(limit = 100): Promise<JobOffer[]> {
  try {
    const result = await client.collection("job-offers").find({
      filters: { online_status: { $eq: "published" } },
      populate: ["contact"],
      pagination: { limit },
    })
    return (result.data ?? []) as unknown as JobOffer[]
  } catch (error) {
    console.error("Error fetching job offers", error)
    return []
  }
}

export async function fetchJobOffer(
  slug: string,
  token = import.meta.env.STRAPI_TOKEN
): Promise<JobOffer | null> {
  try {
    const headers: Record<string, string> = {}
    headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(
      `${strapiUrl}/api/job-offers?filters[uuid][$eq]=${encodeURIComponent(slug)}&populate[0]=contact&populate[1]=owner`,
      {
        headers,
      }
    )

    if (!res.ok) return null
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
      `${strapiUrl}/api/job-offers?filters[owner][id][$eq]=${userId}&populate[0]=contact&sort=createdAt:desc`,
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
