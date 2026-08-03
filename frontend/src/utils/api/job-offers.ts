import prisma from "../prisma"
import { withCache } from "./cache"
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
  id: string
  slug: string
  title: string
  description: string
  company: string
  location: string
  online_status: "submitted" | "published" | "expired" | "rejected" | "archived"
  working_hours: number
  external_url?: string
  job_type: JobType
  field: JobField
  work_mode: WorkMode
  contact: {
    name?: string
    mail?: string
    phone?: string
  }
  ownerId?: string | null
  reports?: { id: string }[]
  createdAt: string
}

export type JobOffersFilter = {
  types?: string[]
  fields?: string[]
  workModes?: string[]
  search?: string
  sort?: string
  page?: number
  pageSize?: number
}

export type JobOfferPage = {
  jobs: JobOffer[]
  total: number
  page: number
  pageCount: number
}

type JobOfferRow = {
  id: string
  slug: string
  title: string
  description: string
  company: string
  location: string
  onlineStatus: string
  workingHours: number
  externalUrl: string | null
  jobType: string
  field: string
  workMode: string
  contactName: string | null
  contactMail: string | null
  contactPhone: string | null
  ownerId: string | null
  createdAt: Date
}

function toJobOffer(row: JobOfferRow, extra?: { reports?: { id: string }[] }): JobOffer {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    company: row.company,
    location: row.location,
    online_status: row.onlineStatus as JobOffer["online_status"],
    working_hours: row.workingHours,
    external_url: row.externalUrl ?? undefined,
    job_type: row.jobType as JobType,
    field: row.field as JobField,
    work_mode: row.workMode as WorkMode,
    contact: {
      name: row.contactName ?? undefined,
      mail: row.contactMail ?? undefined,
      phone: row.contactPhone ?? undefined,
    },
    ownerId: row.ownerId,
    reports: extra?.reports,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function fetchJobOffersPaginated(
  filter: JobOffersFilter = {}
): Promise<ApiResult<JobOfferPage>> {
  const { types, fields, workModes, search, sort = "newest", page = 1, pageSize = 12 } = filter

  const where = { onlineStatus: "published" } as {
    onlineStatus: string
    jobType?: { in: string[] }
    field?: { in: string[] }
    workMode?: { in: string[] }
    OR?: { title?: object; company?: object }[]
  }
  if (types && types.length > 0) where.jobType = { in: types }
  if (fields && fields.length > 0) where.field = { in: fields }
  if (workModes && workModes.length > 0) where.workMode = { in: workModes }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ]
  }

  const key = `job-offers:paginated:${JSON.stringify(filter)}`
  try {
    const { rows, total } = await withCache(key, async () => {
      const [rows, total] = await Promise.all([
        prisma.jobOffer.findMany({
          where,
          orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        prisma.jobOffer.count({ where }),
      ])
      return { rows, total }
    })
    const pageCount = Math.max(1, Math.ceil(total / pageSize))
    return {
      data: { jobs: rows.map((row) => toJobOffer(row)), total, page, pageCount },
      apiDown: false,
    }
  } catch (error) {
    console.error("Error fetching job offers (paginated)", error)
    return { data: { jobs: [], total: 0, page: 1, pageCount: 1 }, apiDown: true }
  }
}

export async function fetchJobOffers(limit = 100): Promise<ApiResult<JobOffer[]>> {
  const key = `job-offers:all:${limit}`
  try {
    const rows = await withCache(key, () =>
      prisma.jobOffer.findMany({
        where: { onlineStatus: "published" },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    )
    return { data: rows.map((row) => toJobOffer(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching job offers", error)
    return { data: [], apiDown: true }
  }
}

export async function fetchJobOffer(slug: string): Promise<ApiResult<JobOffer | null>> {
  try {
    const row = await prisma.jobOffer.findFirst({
      where: { slug },
      include: {
        reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
      },
    })
    if (!row) return { data: null, apiDown: false }

    return { data: toJobOffer(row, { reports: row.reports }), apiDown: false }
  } catch (error) {
    console.error("Error fetching job offer", error)
    return { data: null, apiDown: true }
  }
}

export async function fetchMyJobOffers(ownerId: string): Promise<ApiResult<JobOffer[]>> {
  try {
    const rows = await prisma.jobOffer.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    })
    return { data: rows.map((row) => toJobOffer(row)), apiDown: false }
  } catch (error) {
    console.error("Error fetching own job offers", error)
    return { data: [], apiDown: true }
  }
}
