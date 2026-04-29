import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { strapiUrl } from "@/utils/api"
import { JOB_TYPES, JOB_FIELDS, WORK_MODES } from "@/utils/api/job-offers"

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
  external_url: z.url().max(2048).optional(),
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
        console.error("Job delete failed:", data?.error)
        throw new ActionError({ code: "FORBIDDEN", message: "Löschen fehlgeschlagen." })
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
        console.error("Job archive failed:", data?.error)
        throw new ActionError({ code: "FORBIDDEN", message: "Archivieren fehlgeschlagen." })
      }

      return {}
    },
  }),

  update: defineAction({
    accept: "form",
    input: z.object({
      documentId: z.string().min(1),
      title: z.string().min(1, "Bitte Stellenbezeichnung eingeben.").max(200),
      company: z.string().min(1, "Bitte Unternehmen eingeben.").max(200),
      location: z.string().min(1, "Bitte Ort eingeben.").max(200),
      working_hours: z.coerce.number().int().min(0, "Bitte gültige Stundenzahl eingeben."),
      description: z.string().min(1, "Bitte Beschreibung eingeben."),
      job_type: z.enum(JOB_TYPES).default("other"),
      field: z.enum(JOB_FIELDS).default("other"),
      work_mode: z.enum(WORK_MODES).default("on_site"),
      contact_name: z.string().max(200).optional(),
      contact_mail: z.email().max(254).optional(),
      contact_phone: z.string().max(50).optional(),
      external_url: z.url().max(2048).optional(),
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
            job_type: fields.job_type,
            field: fields.field,
            work_mode: fields.work_mode,
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
        console.error("Job update failed:", data?.error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Aktualisierung fehlgeschlagen." })
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
            job_type: input.job_type,
            field: input.field,
            work_mode: input.work_mode,
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
        console.error("Job create failed:", data?.error)
        throw new ActionError({ code: "BAD_REQUEST", message: "Einreichung fehlgeschlagen." })
      }

      return { uuid: data.data.uuid }
    },
  }),
}
