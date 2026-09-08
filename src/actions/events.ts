import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { EVENT_CATEGORIES } from "@/utils/api/events"
import { invalidateCacheByPrefix } from "@/utils/api/cache"
import { createWithUniqueSlug } from "@/utils/slugify"
import { canModerateEvents } from "@/utils/authz"
import { requireUserId, assertOwnerOrPermission, mutationError } from "@/utils/action-guards"
import prisma from "@/utils/prisma"
import { httpUrl } from "./schemas"

const locationFieldsShape = {
  location_type: z.enum(["none", "linked", "custom"]).default("none"),
  map_location_id: z.string().optional(),
  custom_location_name: z.string().max(200).optional(),
  custom_location_address: z.string().max(300).optional(),
  custom_location_city: z.string().max(100).optional(),
}

type LocationFields = z.infer<z.ZodObject<typeof locationFieldsShape>>

function buildLocationData(input: LocationFields) {
  if (input.location_type === "linked" && input.map_location_id) {
    return {
      mapLocationId: input.map_location_id,
      customLocationName: null,
      customLocationAddress: null,
      customLocationCity: null,
    }
  }
  if (input.location_type === "custom" && input.custom_location_name) {
    return {
      mapLocationId: null,
      customLocationName: input.custom_location_name,
      customLocationAddress: input.custom_location_address || null,
      customLocationCity: input.custom_location_city || null,
    }
  }
  return {
    mapLocationId: null,
    customLocationName: null,
    customLocationAddress: null,
    customLocationCity: null,
  }
}

const eventBaseSchema = z
  .object({
    title: z.string().min(1, "Bitte Titel eingeben.").max(200),
    organizer: z.string().min(1, "Bitte Veranstalter eingeben.").max(200),
    description: z.string().min(1, "Bitte Beschreibung eingeben."),
    start: z.string().min(1, "Bitte Startzeit eingeben."),
    end: z.string().min(1, "Bitte Endzeit eingeben."),
    category: z.enum(EVENT_CATEGORIES).default("other"),
    external_url: httpUrl.optional(),
  })
  .extend(locationFieldsShape)

const startBeforeEnd = (data: { start: string; end: string }) =>
  new Date(data.start) < new Date(data.end)
const startBeforeEndMsg = { path: ["start"], message: "Startzeit muss vor Endzeit liegen." }

const eventCreateSchema = eventBaseSchema.refine(startBeforeEnd, startBeforeEndMsg)

export const events = {
  delete: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      const userId = requireUserId(context)

      const event = await prisma.event.findUnique({ where: { id }, select: { ownerId: true } })
      if (!event) throw new ActionError({ code: "NOT_FOUND", message: "Event nicht gefunden." })
      await assertOwnerOrPermission(
        context,
        userId,
        event.ownerId,
        undefined,
        "Löschen fehlgeschlagen."
      )

      try {
        await prisma.event.delete({ where: { id } })
      } catch (error) {
        console.error("Event delete failed:", error)
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Löschen fehlgeschlagen." })
      }

      invalidateCacheByPrefix("events:")
      return {}
    },
  }),

  unpublish: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1), reason: z.string().max(500).optional() }),
    handler: async ({ id, reason }, context) => {
      const userId = requireUserId(context)

      const event = await prisma.event.findUnique({ where: { id }, select: { ownerId: true } })
      if (!event) throw new ActionError({ code: "NOT_FOUND", message: "Event nicht gefunden." })
      await assertOwnerOrPermission(
        context,
        userId,
        event.ownerId,
        canModerateEvents,
        "Depublizieren fehlgeschlagen."
      )

      try {
        await prisma.event.update({
          where: { id },
          data: { hidden: true, rejectionReason: reason || null },
        })
      } catch (error) {
        console.error("Event unpublish failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Depublizieren fehlgeschlagen.",
        })
      }

      invalidateCacheByPrefix("events:")
      return {}
    },
  }),

  publish: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      const userId = requireUserId(context)

      const event = await prisma.event.findUnique({
        where: { id },
        select: { ownerId: true, rejectionReason: true },
      })
      if (!event) throw new ActionError({ code: "NOT_FOUND", message: "Event nicht gefunden." })

      // A rejectionReason that is not null means that a moderator unpublished this event. An
      // unpublish by the owner on the account page keeps the reason unset. Only a moderator
      // can thus publish the event again, and the owner cannot cancel a moderation decision.
      if (event.rejectionReason) {
        if (!(await canModerateEvents(context.locals.user?.role))) {
          throw new ActionError({
            code: "FORBIDDEN",
            message: "Veröffentlichen fehlgeschlagen.",
          })
        }
      } else {
        await assertOwnerOrPermission(
          context,
          userId,
          event.ownerId,
          canModerateEvents,
          "Veröffentlichen fehlgeschlagen."
        )
      }

      try {
        await prisma.event.update({
          where: { id },
          data: { hidden: false, rejectionReason: null },
        })
      } catch (error) {
        console.error("Event publish failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Veröffentlichen fehlgeschlagen.",
        })
      }

      invalidateCacheByPrefix("events:")
      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: eventBaseSchema
      .extend({ id: z.string().min(1) })
      .refine(startBeforeEnd, startBeforeEndMsg),
    handler: async ({ id, ...fields }, context) => {
      const userId = requireUserId(context)

      const existing = await prisma.event.findUnique({ where: { id }, select: { ownerId: true } })
      if (!existing) throw new ActionError({ code: "NOT_FOUND", message: "Event nicht gefunden." })
      await assertOwnerOrPermission(
        context,
        userId,
        existing.ownerId,
        canModerateEvents,
        "Aktualisierung fehlgeschlagen."
      )

      let updated: { slug: string }
      try {
        updated = await prisma.event.update({
          where: { id },
          data: {
            title: fields.title,
            organizer: fields.organizer,
            description: fields.description,
            start: new Date(fields.start),
            end: new Date(fields.end),
            category: fields.category,
            externalUrl: fields.external_url || null,
            ...buildLocationData(fields),
          },
        })
      } catch (error) {
        throw mutationError(error, "Event update failed", "Aktualisierung fehlgeschlagen.")
      }

      invalidateCacheByPrefix("events:")
      return { slug: updated.slug }
    },
  }),

  create: defineAction({
    accept: "form",
    input: eventCreateSchema,
    handler: async (input, context) => {
      const userId = requireUserId(context)

      let created: { slug: string }
      try {
        created = await createWithUniqueSlug(input.title, (slug) =>
          prisma.event.create({
            data: {
              slug,
              title: input.title,
              organizer: input.organizer,
              description: input.description,
              start: new Date(input.start),
              end: new Date(input.end),
              category: input.category,
              externalUrl: input.external_url || null,
              ownerId: userId,
              ...buildLocationData(input),
            },
          })
        )
      } catch (error) {
        throw mutationError(error, "Event create failed", "Einreichung fehlgeschlagen.")
      }

      invalidateCacheByPrefix("events:")
      return { slug: created.slug }
    },
  }),
}
