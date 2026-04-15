import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { strapiUrl } from "@/utils/api"

const jobCreateSchema = z.object({
  title: z.string().min(1, "Bitte Stellenbezeichnung eingeben."),
  company: z.string().min(1, "Bitte Unternehmen eingeben."),
  location: z.string().min(1, "Bitte Ort eingeben."),
  working_hours: z.coerce.number().int().min(0, "Bitte gültige Stundenzahl eingeben."),
  description: z.string().min(1, "Bitte Beschreibung eingeben."),
  contact_name: z.string().optional(),
  contact_mail: z.string().optional(),
  contact_phone: z.string().optional(),
  external_url: z.string().optional(),
})

export const jobs = {
  delete: defineAction({
    accept: "form",
    input: z.object({ documentId: z.string().min(1) }),
    handler: async ({ documentId }, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const res = await fetch(`${strapiUrl}/api/job-offers/${documentId}`, {
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

  archive: defineAction({
    accept: "form",
    input: z.object({ documentId: z.string().min(1) }),
    handler: async ({ documentId }, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const res = await fetch(`${strapiUrl}/api/job-offers/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ data: { online_status: "archived" } }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new ActionError({
          code: "FORBIDDEN",
          message: data?.error?.message ?? "Archivieren fehlgeschlagen.",
        })
      }

      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: z.object({
      documentId: z.string().min(1),
      title: z.string().min(1, "Bitte Stellenbezeichnung eingeben."),
      company: z.string().min(1, "Bitte Unternehmen eingeben."),
      location: z.string().min(1, "Bitte Ort eingeben."),
      working_hours: z.coerce.number().int().min(0, "Bitte gültige Stundenzahl eingeben."),
      description: z.string().min(1, "Bitte Beschreibung eingeben."),
      contact_name: z.string().optional(),
      contact_mail: z.string().optional(),
      contact_phone: z.string().optional(),
      external_url: z.string().optional(),
    }),
    handler: async ({ documentId, ...fields }, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })

      const res = await fetch(`${strapiUrl}/api/job-offers/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          data: {
            title: fields.title,
            company: fields.company,
            location: fields.location,
            working_hours: fields.working_hours,
            description: fields.description,
            external_url: fields.external_url || undefined,
            contact: {
              name: fields.contact_name || undefined,
              mail: fields.contact_mail || undefined,
              phone: fields.contact_phone || undefined,
            },
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

      return { uuid: data.data.uuid as string }
    },
  }),

  create: defineAction({
    accept: "form",
    input: jobCreateSchema,
    handler: async (input, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
      }

      const res = await fetch(`${strapiUrl}/api/job-offers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            title: input.title,
            company: input.company,
            location: input.location,
            working_hours: input.working_hours,
            description: input.description,
            external_url: input.external_url || undefined,
            contact: {
              name: input.contact_name || undefined,
              mail: input.contact_mail || undefined,
              phone: input.contact_phone || undefined,
            },
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

      return { uuid: data.data.uuid }
    },
  }),
}
