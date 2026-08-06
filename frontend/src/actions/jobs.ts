import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { JOB_TYPES, JOB_FIELDS, WORK_MODES } from "@/utils/api/job-offers"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { slugify, uniqueSlug } from "@/utils/slugify"
import prisma from "@/utils/prisma"

const httpUrl = z
  .url()
  .max(2048)
  .refine((url) => /^https?:\/\//i.test(url), "Nur http(s)-URLs sind erlaubt.")

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
      const userId = context.locals.user?.id
      if (!userId) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const job = await prisma.jobOffer.findUnique({ where: { id }, select: { ownerId: true } })
      if (!job) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      if (job.ownerId !== userId) {
        throw new ActionError({ code: "FORBIDDEN", message: "Löschen fehlgeschlagen." })
      }

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
      const userId = context.locals.user?.id
      if (!userId) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const job = await prisma.jobOffer.findUnique({ where: { id }, select: { ownerId: true } })
      if (!job) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      if (job.ownerId !== userId) {
        throw new ActionError({ code: "FORBIDDEN", message: "Archivieren fehlgeschlagen." })
      }

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

  update: defineAction({
    accept: "form",
    input: jobCreateSchema.extend({
      id: z.string().min(1),
      contact_name: z.string().max(200).optional(),
    }),
    handler: async ({ id, ...fields }, context) => {
      const userId = context.locals.user?.id
      if (!userId) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const existing = await prisma.jobOffer.findUnique({
        where: { id },
        select: { ownerId: true },
      })
      if (!existing) throw new ActionError({ code: "NOT_FOUND", message: "Stelle nicht gefunden." })
      if (existing.ownerId !== userId) {
        throw new ActionError({ code: "FORBIDDEN", message: "Aktualisierung fehlgeschlagen." })
      }

      let updated: { slug: string }
      try {
        updated = await prisma.jobOffer.update({
          where: { id },
          data: {
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
          },
        })
      } catch (error) {
        console.error("Job update failed:", error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Aktualisierung fehlgeschlagen." })
      }

      invalidateCacheByPrefix("job-offers:")
      return { slug: updated.slug }
    },
  }),

  create: defineAction({
    accept: "form",
    input: jobCreateSchema,
    handler: async (input, context) => {
      const userId = context.locals.user?.id
      if (!userId) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
      }
      if (!context.locals.user?.emailVerified) {
        throw new ActionError({
          code: "FORBIDDEN",
          message: "Bitte bestätige zuerst deine E-Mail-Adresse, bevor du eine Stelle einreichst.",
        })
      }

      let created: { slug: string }
      try {
        const slug = await uniqueSlug(
          slugify(input.title),
          async (candidate) =>
            (await prisma.jobOffer.findUnique({ where: { slug: candidate } })) != null
        )

        created = await prisma.jobOffer.create({
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
          },
        })
      } catch (error) {
        console.error("Job create failed:", error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Einreichung fehlgeschlagen." })
      }

      invalidateCacheByPrefix("job-offers:")
      return { slug: created.slug }
    },
  }),
}
