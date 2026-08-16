import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { createUniqueSlug } from "@/utils/slugify"
import { canManageStudentGroups } from "@/utils/authz"
import { requirePermission } from "@/utils/action-guards"
import prisma from "@/utils/prisma"

const httpUrl = z
  .url()
  .max(2048)
  .refine((url) => /^https?:\/\//i.test(url), "Nur http(s)-URLs sind erlaubt.")

const studentGroupBaseSchema = z.object({
  name: z.string().min(1, "Bitte Namen eingeben.").max(200),
  description: z.string().min(1, "Bitte Beschreibung eingeben.").max(2000),
  website: httpUrl.optional(),
  instagram: httpUrl.optional(),
  facebook: httpUrl.optional(),
  email: z.email().max(254).optional(),
})

export const studentGroups = {
  delete: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      await requirePermission(context, canManageStudentGroups)

      const group = await prisma.studentGroup.findUnique({ where: { id }, select: { id: true } })
      if (!group) throw new ActionError({ code: "NOT_FOUND", message: "Gruppe nicht gefunden." })

      try {
        await prisma.studentGroup.delete({ where: { id } })
      } catch (error) {
        console.error("Student group delete failed:", error)
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Löschen fehlgeschlagen." })
      }

      invalidateCacheByPrefix("student-groups:")
      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: studentGroupBaseSchema.extend({ id: z.string().min(1) }),
    handler: async ({ id, ...fields }, context) => {
      await requirePermission(context, canManageStudentGroups)

      const existing = await prisma.studentGroup.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!existing) {
        throw new ActionError({ code: "NOT_FOUND", message: "Gruppe nicht gefunden." })
      }

      let updated: { slug: string }
      try {
        updated = await prisma.studentGroup.update({
          where: { id },
          data: {
            name: fields.name,
            description: fields.description,
            website: fields.website || null,
            instagram: fields.instagram || null,
            facebook: fields.facebook || null,
            email: fields.email || null,
          },
        })
      } catch (error) {
        console.error("Student group update failed:", error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Aktualisierung fehlgeschlagen." })
      }

      invalidateCacheByPrefix("student-groups:")
      return { slug: updated.slug }
    },
  }),

  create: defineAction({
    accept: "form",
    input: studentGroupBaseSchema,
    handler: async (input, context) => {
      await requirePermission(context, canManageStudentGroups)

      let created: { slug: string }
      try {
        const slug = await createUniqueSlug(
          (slug) => prisma.studentGroup.findUnique({ where: { slug } }),
          input.name
        )

        created = await prisma.studentGroup.create({
          data: {
            slug,
            name: input.name,
            description: input.description,
            website: input.website || null,
            instagram: input.instagram || null,
            facebook: input.facebook || null,
            email: input.email || null,
          },
        })
      } catch (error) {
        console.error("Student group create failed:", error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Erstellen fehlgeschlagen." })
      }

      invalidateCacheByPrefix("student-groups:")
      return { slug: created.slug }
    },
  }),
}
