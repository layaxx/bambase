import he from "he"
import { JobField, JobOnlineStatus, JobType, WorkMode } from "@/generated/prisma/enums"
import prisma from "./prisma"
import { slugify, uniqueSlug } from "./slugify"

const FEKI_JOBS_URL = "https://feki.de/api/jobboerse/jobs"

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

const jobTypeByCategoryId: Record<string, JobType> = {
  "1": JobType.part_time,
  "2": JobType.internship,
  "3": JobType.research_assistant,
  "4": JobType.working_student,
  "5": JobType.other,
  "6": JobType.other,
  "10": JobType.volunteer,
  "11": JobType.other,
  "12": JobType.other,
  "13": JobType.thesis,
}

function getJobType(job: Pick<DrupalJob, "category_id">): JobType {
  return jobTypeByCategoryId[job.category_id] ?? JobType.other
}

const statusByCode: Record<DrupalJob["status"], JobOnlineStatus> = {
  "1": JobOnlineStatus.published,
  "2": JobOnlineStatus.archived,
  "3": JobOnlineStatus.archived,
  "0": JobOnlineStatus.submitted,
}

function getStatus(job: DrupalJob, now: Date): JobOnlineStatus {
  const offlineDate = new Date(job.offline_date)
  const status = statusByCode[job.status]
  if (offlineDate < now && status === JobOnlineStatus.published) return JobOnlineStatus.expired
  return status
}

async function fetchJobsPage(page: number, cookie: string): Promise<JobsApiResponse> {
  const response = await fetch(`${FEKI_JOBS_URL}?limit=100&page=${page}`, {
    headers: { cookie },
  })
  if (!response.ok) {
    throw new Error(`Received status ${response.status} for page ${page}`)
  }
  return (await response.json()) as JobsApiResponse
}

async function fetchAllJobs(cookie: string): Promise<DrupalJob[]> {
  const firstPage = await fetchJobsPage(0, cookie)
  const allJobs: DrupalJob[] = [...firstPage.data]

  for (let page = 1; page < firstPage.pageCount; page++) {
    try {
      // eslint-disable-next-line no-await-in-loop -- feki.de paginates and does not support parallel page fetches
      const nextPage = await fetchJobsPage(page, cookie)
      allJobs.push(...nextPage.data)
    } catch (error) {
      console.error(
        `[feki] Failed to fetch page ${page}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  return allJobs
}

export async function syncJobOffers(): Promise<void> {
  const cookie = process.env.JOB_OFFER_MIGRATION_COOKIE
  if (!cookie) {
    console.warn(
      "[feki] JOB_OFFER_MIGRATION_COOKIE is not set. Skipping job offer migration. Set this environment variable to enable it."
    )
    return
  }

  let allJobs: DrupalJob[]
  try {
    allJobs = await fetchAllJobs(cookie)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[feki] Failed to fetch job offers: ${message}`)
    throw new Error(`Failed to fetch job offers: ${message}`, { cause: error })
  }

  console.warn(`[feki] Fetched ${allJobs.length} job offers`)

  const existing = await prisma.jobOffer.findMany({
    where: { externalId: { not: null } },
    select: { externalId: true },
  })
  const existingIds = new Set(existing.map((offer) => offer.externalId))

  const now = new Date()
  let created = 0
  let skipped = 0

  for (const job of allJobs) {
    if (existingIds.has(job.uuid)) {
      skipped++
      continue
    }

    const title = he.decode(job.title)

    try {
      // eslint-disable-next-line no-await-in-loop -- slug uniqueness check depends on previously created slugs
      const slug = await uniqueSlug(
        slugify(title),
        async (candidate) =>
          (await prisma.jobOffer.findUnique({ where: { slug: candidate } })) != null
      )

      // eslint-disable-next-line no-await-in-loop -- online status is set after creation, mirroring the original migration
      await prisma.jobOffer.create({
        data: {
          slug,
          title,
          description: htmlToText(job.description),
          company: he.decode(job.company_name),
          location: he.decode(job.location),
          externalUrl: job.url,
          externalId: job.uuid,
          createdAt: new Date(job.creation_date),
          workingHours: Number(job.hours_per_week) || 0,
          jobType: getJobType(job),
          field: JobField.other,
          workMode: WorkMode.on_site,
          contactName: he.decode(job.contact_person),
          contactMail: he.decode(job.contact_mail),
          contactPhone: job.contact_tel,
          onlineStatus: getStatus(job, now),
        },
      })
      created++
    } catch (error) {
      console.error(
        `[feki] Failed to create job offer "${title}": ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  console.warn(`[feki] Done — created: ${created}, skipped (already exist): ${skipped}`)
}
