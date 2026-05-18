import he from "he"

function htmlToText(html: string): string {
  return he
    .decode(
      html
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

interface DrupalJob {
  id: string
  user_id: string
  title: string
  description: string
  company_name: string
  url: string
  location: string
  creation_date: string
  hours_per_week: string
  qualification: string
  status: "0" | "1" | "2" | "3"
  category_id: string
  contact_person: string
  contact_tel: string
  contact_mail: string
  uuid: string
  offline_date: string
  file_path: string
  reject_reason?: string
}

interface JobsApiResponse {
  data: DrupalJob[]
  pageCount: number
}

function getJobType(
  job: Pick<DrupalJob, "category_id">
):
  | "other"
  | "part_time"
  | "internship"
  | "working_student"
  | "research_assistant"
  | "thesis"
  | "volunteer" {
  const map = {
    "1": "part_time",
    "2": "internship",
    "3": "research_assistant",
    "4": "working_student",
    "5": "other",
    "6": "other",
    "10": "volunteer",
    "11": "other",
    "12": "other",
    "13": "thesis",
  }
  return map[job.category_id] || "other"
}

const statusMap = {
  "1": "published",
  "2": "archived",
  "3": "archived",
  "0": "submitted",
} as const

function getStatus(
  offer: DrupalJob,
  now: Date
): "published" | "submitted" | "expired" | "rejected" | "archived" {
  const offlineDate = new Date(offer.offline_date)
  const status = statusMap[offer.status]
  if (offlineDate < now && status === "published") return "expired"
  return status
}

async function load() {
  const firstPageResponse = await fetch("https://feki.de/api/jobboerse/jobs?limit=100&page=0", {
    headers: { cookie: process.env.JOB_OFFER_MIGRATION_COOKIE },
  })

  if (!firstPageResponse.ok) {
    strapi.log.error(
      `[job-offer migration] Failed to fetch first page: ${firstPageResponse.statusText}`
    )
    return
  }

  const firstPageData = (await firstPageResponse.json()) as JobsApiResponse
  const pageCount = firstPageData.pageCount
  strapi.log.info(`[job-offer migration] Total pages to fetch: ${pageCount}`)

  const allJobs: DrupalJob[] = [...firstPageData.data]

  for (let page = 1; page < pageCount; page++) {
    try {
      const response = await fetch(`https://feki.de/api/jobboerse/jobs?limit=100&page=${page}`, {
        headers: { cookie: process.env.JOB_OFFER_MIGRATION_COOKIE },
      })
      if (!response.ok) {
        strapi.log.error(
          `[job-offer migration] Failed to fetch page ${page}: ${response.statusText}`
        )
        continue
      }
      const data = (await response.json()) as JobsApiResponse
      allJobs.push(...data.data)
      strapi.log.info(`[job-offer migration] Fetched page ${page} with ${data.data.length} jobs`)
    } catch (error) {
      strapi.log.error(
        `[job-offer migration] Error fetching page ${page}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  strapi.log.info(`[job-offer migration] Total jobs fetched: ${allJobs.length}`)

  const existingDocs = await strapi.documents("api::job-offer.job-offer").findMany({
    fields: ["external_id"],
    filters: { external_id: { $notNull: true } },
    pagination: { pageSize: 10_000 },
  })
  const existingIds = new Set(existingDocs.map((d) => d.external_id))

  const now = new Date()
  let created = 0
  let skipped = 0
  for (const job of allJobs) {
    if (existingIds.has(job.uuid)) {
      skipped++
      continue
    }

    try {
      const doc = await strapi.documents("api::job-offer.job-offer").create({
        data: {
          title: he.decode(job.title),
          description: htmlToText(job.description),
          company: he.decode(job.company_name),
          external_url: job.url,
          location: he.decode(job.location),
          createdAt: job.creation_date,
          working_hours: Number(job.hours_per_week),
          job_type: getJobType(job),
          field: "other",
          work_mode: "on_site",
          contact: {
            name: he.decode(job.contact_person),
            phone: job.contact_tel,
            mail: he.decode(job.contact_mail),
          },
          external_id: job.uuid,
        },
      })
      await strapi.documents("api::job-offer.job-offer").update({
        documentId: doc.documentId,
        data: { online_status: getStatus(job, now) },
      })
      created++
    } catch (error) {
      strapi.log.error(
        `[job-offer migration] Error creating job offer for "${job.title}": ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  strapi.log.info(
    `[job-offer migration] Done — created: ${created}, skipped (already exist): ${skipped}`
  )
}

export default () => ({
  load,
})
