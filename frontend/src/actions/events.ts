import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { strapiUrl } from "@/utils/api"
import { EVENT_CATEGORIES } from "@/utils/api/events"

const locationFieldsShape = {
  location_type: z.enum(["none", "linked", "custom"]).default("none"),
  map_location_id: z.string().optional(),
  custom_location_name: z.string().optional(),
  custom_location_address: z.string().optional(),
  custom_location_city: z.string().optional(),
}

type LocationFields = z.infer<z.ZodObject<typeof locationFieldsShape>>

function buildLocationData(input: LocationFields) {
  if (input.location_type === "linked" && input.map_location_id) {
    return {
      map_location: { connect: [{ documentId: input.map_location_id }] },
      custom_location: null,
    }
  }
  if (input.location_type === "custom" && input.custom_location_name) {
    return {
      map_location: null,
      custom_location: {
        name: input.custom_location_name,
        address: input.custom_location_address || undefined,
        city: input.custom_location_city || undefined,
      },
    }
  }
  return { custom_location: null, map_location: null }
}

const eventBaseSchema = z
  .object({
    title: z.string().min(1, "Bitte Titel eingeben."),
    organizer: z.string().min(1, "Bitte Veranstalter eingeben."),
    description: z.string().min(1, "Bitte Beschreibung eingeben."),
    start: z.string().min(1, "Bitte Startzeit eingeben."),
    end: z.string().min(1, "Bitte Endzeit eingeben."),
    category: z.enum(EVENT_CATEGORIES).default("other"),
    external_url: z.string().optional(),
  })
  .extend(locationFieldsShape)

const startBeforeEnd = (data: { start: string; end: string }) =>
  new Date(data.start) < new Date(data.end)
const startBeforeEndMsg = { path: ["start"], message: "Startzeit muss vor Endzeit liegen." }

const eventCreateSchema = eventBaseSchema.refine(startBeforeEnd, startBeforeEndMsg)

export const events = {
  delete: defineAction({
    accept: "form",
    input: z.object({ documentId: z.string().min(1) }),
    handler: async ({ documentId }, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const res = await fetch(`${strapiUrl}/api/events/${documentId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new ActionError({
          code: "FORBIDDEN",
          message: data?.error?.message ?? "Löschen fehlgeschlagen.",
        })
      }

      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: eventBaseSchema
      .extend({ documentId: z.string().min(1) })
      .refine(startBeforeEnd, startBeforeEndMsg),
    handler: async ({ documentId, ...fields }, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const res = await fetch(`${strapiUrl}/api/events/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data: {
            title: fields.title,
            organizer: fields.organizer,
            description: fields.description,
            start: fields.start,
            end: fields.end,
            category: fields.category,
            external_url: fields.external_url || undefined,
            ...buildLocationData(fields),
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: data?.error?.message ?? "Aktualisierung fehlgeschlagen.",
        })
      }

      return { slug: data.data.slug as string }
    },
  }),

  create: defineAction({
    accept: "form",
    input: eventCreateSchema,
    handler: async (input, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
      }

      const res = await fetch(`${strapiUrl}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title: input.title,
            organizer: input.organizer,
            description: input.description,
            start: input.start,
            end: input.end,
            category: input.category,
            external_url: input.external_url || undefined,
            ...buildLocationData(input),
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        console.error("Error creating event:", data.error)
        throw new ActionError({
          code: "BAD_REQUEST",
          message: data?.error?.message ?? "Einreichung fehlgeschlagen.",
        })
      }

      return { slug: data.data.slug }
    },
  }),
}
