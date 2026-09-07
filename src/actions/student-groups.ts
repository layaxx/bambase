import { defineAction } from "astro:actions"
import { z } from "astro/zod"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { createWithUniqueSlug } from "@/utils/slugify"
import { canManageStudentGroups } from "@/utils/authz"
import { requirePermission, mutationError } from "@/utils/action-guards"
import prisma from "@/utils/prisma"
import { httpUrl } from "./schemas"

const studentGroupBaseSchema = z.object({
  name: z.string().min(1, "Bitte Namen eingeben.").max(200),
  description: z.string().min(1, "Bitte Beschreibung eingeben.").max(2000),
  website: httpUrl.optional(),
  instagram: httpUrl.optional(),
  facebook: httpUrl.optional(),
  email: z.email().max(254).optional(),
})

const NOT_FOUND_MESSAGE = "Gruppe nicht gefunden."

export const studentGroups = {
  delete: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      await requirePermission(context, canManageStudentGroups)

      try {
        await prisma.studentGroup.delete({ where: { id } })
      } catch (error) {
        throw mutationError(
          error,
          "Student group delete failed",
          "Löschen fehlgeschlagen.",
          NOT_FOUND_MESSAGE
        )
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
        throw mutationError(
          error,
          "Student group update failed",
          "Aktualisierung fehlgeschlagen.",
          NOT_FOUND_MESSAGE
        )
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
        created = await createWithUniqueSlug(input.name, (slug) =>
          prisma.studentGroup.create({
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
        )
      } catch (error) {
        throw mutationError(error, "Student group create failed", "Erstellen fehlgeschlagen.")
      }

      invalidateCacheByPrefix("student-groups:")
      return { slug: created.slug }
    },
  }),
}
