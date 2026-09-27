import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { JOB_TYPES, JOB_FIELDS, WORK_MODES } from "@/utils/api/job-offers"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { createWithUniqueSlug } from "@/utils/slugify"
import { canModerateJobOffers } from "@/utils/authz"
import {
  requireUserId,
  requirePermission,
  assertOwnerOrPermission,
  mutationError,
} from "@/utils/action-guards"
import prisma from "@/utils/prisma"
import { httpUrl } from "./schemas"
import { JobOnlineStatus } from "@/generated/prisma/enums"
import { getLogger } from "@/utils/logger"
import { notifyJobOwner } from "@/utils/job-notifications"

const JOB_OFFER_LIFETIME_DAYS = 30

/**
 * The statuses on which a moderator already made a decision. An edit by the owner must thus
 * cancel that decision. `published` is live on the site, and `rejected` holds the reason of
 * the moderator. The other statuses (`submitted`, `expired`, `archived`) are offline and wait
 * for moderation or come after it, thus an edit keeps them unchanged.
 */
const MODERATED_STATUSES: JobOnlineStatus[] = [JobOnlineStatus.published, JobOnlineStatus.rejected]

/**
 * Tells if an update must send the offer back to moderation. Without this check, an owner who
 * rewrites the content of an offer that a moderator approved can publish any text under that
 * approval. A moderator edits the offer directly, thus the edit is itself the decision.
 */
/** What a moderation update returns: enough to write the owner a mail. */
const notifySelect = {
  slug: true,
  title: true,
  rejectionReason: true,
  owner: { select: { id: true, email: true } },
} as const

/** A moderator who decides on an own offer needs no mail about it. */
function recipient(
  owner: { id: string; email: string } | null,
  actorId: string | undefined
): string | undefined {
  return owner && owner.id !== actorId ? owner.email : undefined
}

/**
 * Publishes or rejects one offer and mails its owner. Approve and reject take several ids so
 * that a moderator can clear the queue in one submit.
 */
async function moderate(
  id: string,
  status: "published" | "rejected",
  reason: string | null,
  context: { locals: Pick<App.Locals, "user">; url: URL }
): Promise<void> {
  const verb = status === "published" ? "approve" : "reject"
  let job
  try {
    job = await prisma.jobOffer.update({
      where: { id },
      data: { onlineStatus: status, rejectionReason: reason },
      select: notifySelect,
    })
  } catch (error) {
    getLogger().error({ err: error, jobOfferId: id }, `job ${verb} failed`)
    throw new ActionError({
      code: "INTERNAL_SERVER_ERROR",
      message: status === "published" ? "Genehmigen fehlgeschlagen." : "Ablehnen fehlgeschlagen.",
    })
  }

  getLogger().info({ jobOfferId: id }, `job ${status === "published" ? "approved" : "rejected"}`)
  invalidateCacheByPrefix("job-offers:")
  await notifyJobOwner(
    recipient(job.owner, context.locals.user?.id),
    job,
    status,
    context.url.origin
  )
}

function needsRemoderation(
  isModerator: boolean,
  contentChanged: boolean,
  status: JobOnlineStatus
): boolean {
  return !isModerator && contentChanged && MODERATED_STATUSES.includes(status)
}

const jobCreateSchema = z.object({
  title: z.string().min(1, "Bitte Stellenbezeichnung eingeben.").max(200),
  company: z.string().min(1, "Bitte Unternehmen eingeben.").max(200),
  location: z.string().min(1, "Bitte Ort eingeben.").max(200),
  working_hours: z.coerce.number().int().min(0, "Bitte gültige Stundenzahl eingeben."),
  description: z.string().min(1, "Bitte Beschreibung eingeben."),
  job_type: z.enum(JOB_TYPES).default("other"),
  field: z.enum(JOB_FIELDS).default("other"),
  work_mode: z.enum(WORK_MODES).default("on_site"),
  contact_name: z.string().max(200),
  contact_mail: z.email().max(254).optional(),
  contact_phone: z.string().max(50).optional(),
  external_url: httpUrl.optional(),
})

export const jobs = {
  delete: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      const userId = requireUserId(context)

      const job = await prisma.jobOffer.findUnique({ where: { id }, select: { ownerId: true } })
      if (!job) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      await assertOwnerOrPermission(
        context,
        userId,
        job.ownerId,
        undefined,
        "Löschen fehlgeschlagen."
      )

      try {
        await prisma.jobOffer.delete({ where: { id } })
      } catch (error) {
        getLogger().error({ err: error, jobOfferId: id }, "job delete failed")
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Löschen fehlgeschlagen." })
      }

      getLogger().info({ jobOfferId: id }, "job deleted")
      invalidateCacheByPrefix("job-offers:")
      return {}
    },
  }),

  archive: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      const userId = requireUserId(context)

      const job = await prisma.jobOffer.findUnique({ where: { id }, select: { ownerId: true } })
      if (!job) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      await assertOwnerOrPermission(
        context,
        userId,
        job.ownerId,
        undefined,
        "Archivieren fehlgeschlagen."
      )

      try {
        await prisma.jobOffer.update({ where: { id }, data: { onlineStatus: "archived" } })
      } catch (error) {
        getLogger().error({ err: error, jobOfferId: id }, "job archive failed")
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Archivieren fehlgeschlagen.",
        })
      }

      getLogger().info({ jobOfferId: id }, "job archived")
      invalidateCacheByPrefix("job-offers:")
      return {}
    },
  }),

  approve: defineAction({
    accept: "form",
    input: z.object({ id: z.array(z.string().min(1)).min(1) }),
    handler: async ({ id }, context) => {
      await requirePermission(context, canModerateJobOffers)
      await Promise.all(id.map((jobOfferId) => moderate(jobOfferId, "published", null, context)))
      return {}
    },
  }),

  reject: defineAction({
    accept: "form",
    input: z.object({
      id: z.array(z.string().min(1)).min(1),
      reason: z.string().trim().min(1).max(500),
    }),
    handler: async ({ id, reason }, context) => {
      await requirePermission(context, canModerateJobOffers)
      await Promise.all(id.map((jobOfferId) => moderate(jobOfferId, "rejected", reason, context)))
      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: jobCreateSchema.extend({
      id: z.string().min(1),
      contact_name: z.string().max(200).optional(),
    }),
    handler: async ({ id, ...fields }, context) => {
      const userId = requireUserId(context)

      const existing = await prisma.jobOffer.findUnique({
        where: { id },
        select: {
          ownerId: true,
          onlineStatus: true,
          title: true,
          company: true,
          location: true,
          workingHours: true,
          description: true,
          jobType: true,
          field: true,
          workMode: true,
          externalUrl: true,
          contactName: true,
          contactMail: true,
          contactPhone: true,
        },
      })
      if (!existing) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      const isModerator = await assertOwnerOrPermission(
        context,
        userId,
        existing.ownerId,
        canModerateJobOffers,
        "Aktualisierung fehlgeschlagen."
      )

      const content = {
        title: fields.title,
        company: fields.company,
        location: fields.location,
        workingHours: fields.working_hours,
        description: fields.description,
        jobType: fields.job_type,
        field: fields.field,
        workMode: fields.work_mode,
        externalUrl: fields.external_url || null,
        contactName: fields.contact_name || null,
        contactMail: fields.contact_mail || null,
        contactPhone: fields.contact_phone || null,
      }
      const contentChanged = Object.entries(content).some(
        ([key, value]) => existing[key as keyof typeof content] !== value
      )

      let updated: { slug: string }
      try {
        updated = await prisma.jobOffer.update({
          where: { id },
          data: {
            ...content,
            ...(needsRemoderation(isModerator, contentChanged, existing.onlineStatus)
              ? { onlineStatus: JobOnlineStatus.submitted, rejectionReason: null }
              : {}),
          },
        })
      } catch (error) {
        throw mutationError(error, "Job update failed", "Aktualisierung fehlgeschlagen.")
      }

      invalidateCacheByPrefix("job-offers:")
      return { slug: updated.slug }
    },
  }),

  create: defineAction({
    accept: "form",
    input: jobCreateSchema,
    handler: async (input, context) => {
      const userId = requireUserId(context)
      if (!context.locals.user?.emailVerified) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Bitte bestätige zuerst deine E-Mail-Adresse, bevor du eine Stelle einreichst.",
        })
      }

      let created: { slug: string }
      try {
        created = await createWithUniqueSlug(input.title, (slug) =>
          prisma.jobOffer.create({
            data: {
              slug,
              title: input.title,
              company: input.company,
              location: input.location,
              workingHours: input.working_hours,
              description: input.description,
              jobType: input.job_type,
              field: input.field,
              workMode: input.work_mode,
              externalUrl: input.external_url || null,
              contactName: input.contact_name || null,
              contactMail: input.contact_mail || null,
              contactPhone: input.contact_phone || null,
              ownerId: userId,
              offlineAfter: new Date(Date.now() + JOB_OFFER_LIFETIME_DAYS * 24 * 60 * 60 * 1000),
            },
          })
        )
      } catch (error) {
        throw mutationError(error, "Job create failed", "Einreichung fehlgeschlagen.")
      }

      invalidateCacheByPrefix("job-offers:")
      await notifyJobOwner(
        context.locals.user.email,
        { slug: created.slug, title: input.title },
        "received",
        context.url.origin
      )
      return { slug: created.slug }
    },
  }),
}
