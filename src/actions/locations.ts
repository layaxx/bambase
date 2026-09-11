import { defineAction } from "astro:actions"
import { z } from "astro/zod"
import { LOCATION_CATEGORIES } from "@/utils/api/locations"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { createWithUniqueSlug } from "@/utils/slugify"
import { canManageLocations } from "@/utils/authz"
import { requirePermission, mutationError } from "@/utils/action-guards"
import prisma from "@/utils/prisma"
import { httpUrl } from "./schemas"

const locationBaseSchema = z.object({
  name: z.string().min(1, "Bitte Namen eingeben.").max(200),
  description: z.string().max(2000).optional(),
  category: z.enum(LOCATION_CATEGORIES).default("other"),
  lat: z.coerce.number().min(-90, "Ungültiger Breitengrad.").max(90, "Ungültiger Breitengrad."),
  lon: z.coerce.number().min(-180, "Ungültiger Längengrad.").max(180, "Ungültiger Längengrad."),
  external_url: httpUrl.optional(),
  address_street: z.string().max(200).optional(),
  address_street_number: z.string().max(20).optional(),
  address_city: z.string().max(100).optional(),
  address_zip: z.string().max(20).optional(),
})

const NOT_FOUND_MESSAGE = "Ort nicht gefunden."

export const locations = {
  delete: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      await requirePermission(context, canManageLocations)

      try {
        await prisma.location.delete({ where: { id } })
      } catch (error) {
        throw mutationError(
          error,
          "Location delete failed",
          "Löschen fehlgeschlagen.",
          NOT_FOUND_MESSAGE
        )
      }

      invalidateCacheByPrefix("locations:")
      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: locationBaseSchema.extend({ id: z.string().min(1) }),
    handler: async ({ id, ...fields }, context) => {
      await requirePermission(context, canManageLocations)

      let updated: { slug: string }
      try {
        updated = await prisma.location.update({
          where: { id },
          data: {
            name: fields.name,
            description: fields.description || null,
            category: fields.category,
            lat: fields.lat,
            lon: fields.lon,
            externalUrl: fields.external_url || null,
            addressStreet: fields.address_street || null,
            addressStreetNumber: fields.address_street_number || null,
            addressCity: fields.address_city || null,
            addressZip: fields.address_zip || null,
          },
        })
      } catch (error) {
        throw mutationError(
          error,
          "Location update failed",
          "Aktualisierung fehlgeschlagen.",
          NOT_FOUND_MESSAGE
        )
      }

      invalidateCacheByPrefix("locations:")
      return { slug: updated.slug }
    },
  }),

  create: defineAction({
    accept: "form",
    input: locationBaseSchema,
    handler: async (input, context) => {
      await requirePermission(context, canManageLocations)

      let created: { slug: string }
      try {
        created = await createWithUniqueSlug(input.name, (slug) =>
          prisma.location.create({
            data: {
              slug,
              name: input.name,
              description: input.description || null,
              category: input.category,
              lat: input.lat,
              lon: input.lon,
              externalUrl: input.external_url || null,
              addressStreet: input.address_street || null,
              addressStreetNumber: input.address_street_number || null,
              addressCity: input.address_city || null,
              addressZip: input.address_zip || null,
            },
          })
        )
      } catch (error) {
        throw mutationError(error, "Location create failed", "Erstellen fehlgeschlagen.")
      }

      invalidateCacheByPrefix("locations:")
      return { slug: created.slug }
    },
  }),
}
