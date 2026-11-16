import prisma from "../prisma"
import type { Prisma } from "@/generated/prisma/client"
import { findPage } from "../pagination"
import { JobType, JobField, WorkMode, JobOnlineStatus } from "@/generated/prisma/enums"
import type { JobOfferModel } from "@/generated/prisma/models"

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
  /** The name of the moderator of the last decision, if known. */
  moderatedBy?: string
  reports?: { id: string }[]
  createdAt: string
  updatedAt: string
}

export type JobOffersFilter = {
  types?: JobType[]
  fields?: JobField[]
  workModes?: WorkMode[]
  search?: string
  page?: number
  pageSize?: number
}

export type JobOfferPage = {
  jobs: JobOffer[]
  total: number
  page: number
  pageCount: number
}

function toJobOffer(
  row: JobOfferModel,
  extra?: { reports?: { id: string }[]; moderatedBy?: { name: string } | null }
): JobOffer {
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
    moderatedBy: extra?.moderatedBy?.name,
    reports: extra?.reports,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function searchWhere(search?: string): Prisma.JobOfferWhereInput {
  if (!search) return {}
  return {
    OR: [
      { title: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ],
  }
}

async function findJobPage(
  where: Prisma.JobOfferWhereInput,
  page: number,
  pageSize: number
): Promise<JobOfferPage> {
  const { rows, ...rest } = await findPage(
    page,
    pageSize,
    (window) => prisma.jobOffer.findMany({ where, orderBy: { createdAt: "desc" }, ...window }),
    () => prisma.jobOffer.count({ where })
  )
  return { jobs: rows.map((row) => toJobOffer(row)), ...rest }
}

export function fetchJobOffersPaginated(filter: JobOffersFilter = {}): Promise<JobOfferPage> {
  const { types, fields, workModes, search, page = 1, pageSize = 12 } = filter

  const where: Prisma.JobOfferWhereInput = {
    onlineStatus: JobOnlineStatus.published,
    ...searchWhere(search),
  }
  if (types && types.length > 0) where.jobType = { in: types }
  if (fields && fields.length > 0) where.field = { in: fields }
  if (workModes && workModes.length > 0) where.workMode = { in: workModes }

  return findJobPage(where, page, pageSize)
}

export async function fetchJobOffers(limit = 100): Promise<JobOffer[]> {
  const rows = await prisma.jobOffer.findMany({
    where: { onlineStatus: "published" },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return rows.map((row) => toJobOffer(row))
}

export async function fetchJobOffer(
  slug: string,
  viewer?: { userId?: string | null; isModerator?: boolean }
): Promise<JobOffer | null> {
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
}

export function fetchMyJobOffers(
  ownerId: string,
  { page = 1, pageSize = 20, search }: Pick<JobOffersFilter, "page" | "pageSize" | "search"> = {}
): Promise<JobOfferPage> {
  return findJobPage({ ownerId, ...searchWhere(search) }, page, pageSize)
}

/** The order of the review queue. The id breaks ties, so the order is the same on each request. */
const QUEUE_ORDER = [
  { createdAt: "asc" },
  { id: "asc" },
] satisfies Prisma.JobOfferOrderByWithRelationInput[]
export async function fetchSubmittedJobOffers(): Promise<JobOffer[]> {
  const rows = await prisma.jobOffer.findMany({
    where: { onlineStatus: "submitted" },
    orderBy: QUEUE_ORDER,
  })
  return rows.map((row) => toJobOffer(row))
}

export function countSubmittedJobOffers(): Promise<number> {
  return prisma.jobOffer.count({ where: { onlineStatus: "submitted" } })
}

type QueueJob = Pick<JobOffer, "id" | "createdAt" | "online_status">

/** The submitted offers before or after an offer, in the order of the queue. */
function queueSide(job: QueueJob, side: "before" | "after"): Prisma.JobOfferWhereInput {
  const createdAt = new Date(job.createdAt)
  const op = side === "before" ? "lt" : "gt"
  return {
    onlineStatus: JobOnlineStatus.submitted,
    OR: [{ createdAt: { [op]: createdAt } }, { createdAt, id: { [op]: job.id } }],
  }
}

const SLUG = { slug: true }
const findNextInQueue = (job: QueueJob) =>
  prisma.jobOffer.findFirst({ where: queueSide(job, "after"), orderBy: QUEUE_ORDER, select: SLUG })

/**
 * Where an offer stands in the review queue: the 1-based position (only for a submitted offer) and
 * the offers right before and after it. The neighbours come from the offer itself, thus they also
 * hold once the offer has left the queue.
 */
export async function fetchQueueNeighbours(job: QueueJob) {
  const [count, ahead, previous, next] = await Promise.all([
    countSubmittedJobOffers(),
    job.online_status === "submitted"
      ? prisma.jobOffer.count({ where: queueSide(job, "before") })
      : 0,
    prisma.jobOffer.findFirst({
      where: queueSide(job, "before"),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: SLUG,
    }),
    findNextInQueue(job),
  ])
  return { count, position: ahead + 1, previous, next }
}

/** The offer to review after this one: the next in the queue or, past its end, the head. */
export async function fetchNextInQueue(job: QueueJob) {
  return (
    (await findNextInQueue(job)) ??
    (await prisma.jobOffer.findFirst({
      where: { onlineStatus: JobOnlineStatus.submitted, id: { not: job.id } },
      orderBy: QUEUE_ORDER,
      select: SLUG,
    }))
  )
}

/** The published and rejected offers, the latest decision first. */
export async function fetchModeratedJobOffers(
  page: number,
  pageSize: number
): Promise<JobOfferPage> {
  const where = { onlineStatus: { in: [JobOnlineStatus.published, JobOnlineStatus.rejected] } }
  const { rows, ...rest } = await findPage(
    page,
    pageSize,
    (window) =>
      prisma.jobOffer.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        include: { moderatedBy: { select: { name: true } } },
        ...window,
      }),
    () => prisma.jobOffer.count({ where })
  )
  return { jobs: rows.map((row) => toJobOffer(row, row)), ...rest }
}
