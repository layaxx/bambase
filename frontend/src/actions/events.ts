import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { strapiUrl } from "@/utils/api"

const eventCreateSchema = z
  .object({
    title: z.string().min(1, "Bitte Titel eingeben."),
    organizer: z.string().min(1, "Bitte Veranstalter eingeben."),
    description: z.string().min(1, "Bitte Beschreibung eingeben."),
    start: z.string().min(1, "Bitte Startzeit eingeben."),
    end: z.string().min(1, "Bitte Endzeit eingeben."),
    external_url: z.string().optional(),
  })
  .refine((data) => new Date(data.start) < new Date(data.end), {
    path: ["start"],
    message: "Startzeit muss vor Endzeit liegen.",
  })

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
    input: z
      .object({
        documentId: z.string().min(1),
        title: z.string().min(1, "Bitte Titel eingeben."),
        organizer: z.string().min(1, "Bitte Veranstalter eingeben."),
        description: z.string().min(1, "Bitte Beschreibung eingeben."),
        start: z.string().min(1, "Bitte Startzeit eingeben."),
        end: z.string().min(1, "Bitte Endzeit eingeben."),
        external_url: z.string().optional(),
      })
      .refine((data) => new Date(data.start) < new Date(data.end), {
        path: ["start"],
        message: "Startzeit muss vor Endzeit liegen.",
      }),
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
            external_url: fields.external_url || undefined,
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
            external_url: input.external_url || undefined,
          },
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: data?.error?.message ?? "Einreichung fehlgeschlagen.",
        })
      }

      return { slug: data.data.slug }
    },
  }),
}
