import prisma from "../prisma"
import { withCache } from "./cache"
import { apiResult, type ApiResult } from "./types"
import { JobType, JobField, WorkMode, JobOnlineStatus } from "@/generated/prisma/enums"

export const JOB_TYPES = Object.values(JobType)
export const JOB_FIELDS = Object.values(JobField)
export const WORK_MODES = Object.values(WorkMode)

export type { JobType, JobField, WorkMode }

export type JobOffer = {
  id: string
  slug: string
  title: string
  description: string
  company: string
  location: string
  online_status: JobOnlineStatus
  rejection_reason?: string
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
  updatedAt: string
}

export type JobOffersFilter = {
  types?: JobType[]
  fields?: JobField[]
  workModes?: WorkMode[]
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

const EMPTY_PAGE: JobOfferPage = { jobs: [], total: 0, page: 1, pageCount: 1 }

type JobOfferRow = {
  id: string
  slug: string
  title: string
  description: string
  company: string
  location: string
  onlineStatus: JobOnlineStatus
  rejectionReason: string | null
  workingHours: number
  externalUrl: string | null
  jobType: JobType
  field: JobField
  workMode: WorkMode
  contactName: string | null
  contactMail: string | null
  contactPhone: string | null
  ownerId: string | null
  createdAt: Date
  updatedAt: Date
}

function toJobOffer(row: JobOfferRow, extra?: { reports?: { id: string }[] }): JobOffer {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    company: row.company,
    location: row.location,
    online_status: row.onlineStatus,
    rejection_reason: row.rejectionReason ?? undefined,
    working_hours: row.workingHours,
    external_url: row.externalUrl ?? undefined,
    job_type: row.jobType,
    field: row.field,
    work_mode: row.workMode,
    contact: {
      name: row.contactName ?? undefined,
      mail: row.contactMail ?? undefined,
      phone: row.contactPhone ?? undefined,
    },
    ownerId: row.ownerId,
    reports: extra?.reports,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function fetchJobOffersPaginated(
  filter: JobOffersFilter = {}
): Promise<ApiResult<JobOfferPage>> {
  const { types, fields, workModes, search, sort = "newest", page = 1, pageSize = 12 } = filter

  const where = { onlineStatus: JobOnlineStatus.published } as {
    onlineStatus: JobOnlineStatus
    jobType?: { in: JobType[] }
    field?: { in: JobField[] }
    workMode?: { in: WorkMode[] }
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
  return apiResult("Error fetching job offers (paginated)", EMPTY_PAGE, async () => {
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
    return { jobs: rows.map((row) => toJobOffer(row)), total, page, pageCount }
  })
}

export function fetchJobOffers(limit = 100): Promise<ApiResult<JobOffer[]>> {
  return apiResult("Error fetching job offers", [], async () => {
    const rows = await withCache(`job-offers:all:${limit}`, () =>
      prisma.jobOffer.findMany({
        where: { onlineStatus: "published" },
        orderBy: { createdAt: "desc" },
        take: limit,
      })
    )
    return rows.map((row) => toJobOffer(row))
  })
}

export function fetchJobOffer(
  slug: string,
  viewer?: { userId?: string | null; isModerator?: boolean }
): Promise<ApiResult<JobOffer | null>> {
  return apiResult("Error fetching job offer", null, async () => {
    const row = await prisma.jobOffer.findFirst({
      where: { slug },
      include: {
        reports: { where: { reviewStatus: { not: "dismissed" } }, select: { id: true } },
      },
    })
    if (!row) return null

    const isOwner = !!viewer?.userId && row.ownerId === viewer.userId
    if (row.onlineStatus !== "published" && !isOwner && !viewer?.isModerator) return null

    return toJobOffer(row, { reports: row.reports })
  })
}

export function fetchMyJobOffers(ownerId: string): Promise<ApiResult<JobOffer[]>> {
  return apiResult("Error fetching own job offers", [], async () => {
    const rows = await prisma.jobOffer.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    })
    return rows.map((row) => toJobOffer(row))
  })
}

export function fetchSubmittedJobOffers(): Promise<ApiResult<JobOffer[]>> {
  return apiResult("Error fetching submitted job offers", [], async () => {
    const rows = await prisma.jobOffer.findMany({
      where: { onlineStatus: "submitted" },
      orderBy: { createdAt: "asc" },
    })
    return rows.map((row) => toJobOffer(row))
  })
}

export function fetchRecentlyModeratedJobOffers(limit = 10): Promise<ApiResult<JobOffer[]>> {
  return apiResult("Error fetching recently moderated job offers", [], async () => {
    const rows = await prisma.jobOffer.findMany({
      where: { onlineStatus: { in: [JobOnlineStatus.published, JobOnlineStatus.rejected] } },
      orderBy: { updatedAt: "desc" },
      take: limit,
    })
    return rows.map((row) => toJobOffer(row))
  })
}
