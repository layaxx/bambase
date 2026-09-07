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

const JOB_OFFER_LIFETIME_DAYS = 30

/**
 * Statuses a moderator has already ruled on, and that an owner's edit therefore has to undo:
 * `published` is live on the site, `rejected` carries a moderator's reason. The remaining
 * statuses (`submitted`, `expired`, `archived`) are offline and awaiting or past moderation
 * anyway, so an edit leaves them where they are.
 */
const MODERATED_STATUSES: JobOnlineStatus[] = [JobOnlineStatus.published, JobOnlineStatus.rejected]

/**
 * Whether an update has to send the offer back through moderation: an owner who rewrites the
 * content of an offer a moderator already ruled on would otherwise publish arbitrary text under
 * that approval. Moderators edit in place — their edit *is* the moderation decision.
 */
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
        console.error("Job delete failed:", error)
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Löschen fehlgeschlagen." })
      }

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
        console.error("Job archive failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Archivieren fehlgeschlagen.",
        })
      }

      invalidateCacheByPrefix("job-offers:")
      return {}
    },
  }),

  approve: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      await requirePermission(context, canModerateJobOffers)

      try {
        await prisma.jobOffer.update({
          where: { id },
          data: { onlineStatus: "published", rejectionReason: null },
        })
      } catch (error) {
        console.error("Job approve failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Genehmigen fehlgeschlagen.",
        })
      }

      invalidateCacheByPrefix("job-offers:")
      return {}
    },
  }),

  reject: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1), reason: z.string().max(500).optional() }),
    handler: async ({ id, reason }, context) => {
      await requirePermission(context, canModerateJobOffers)

      try {
        await prisma.jobOffer.update({
          where: { id },
          data: { onlineStatus: "rejected", rejectionReason: reason || null },
        })
      } catch (error) {
        console.error("Job reject failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Ablehnen fehlgeschlagen.",
        })
      }

      invalidateCacheByPrefix("job-offers:")
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
      return { slug: created.slug }
    },
  }),
}
