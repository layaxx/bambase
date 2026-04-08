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

const COOKIE_OPTS = {
  path: "/",
  httpOnly: false, // readable by server-side Astro, not by client JS for auth_user display
  sameSite: "strict",
  maxAge: 60 * 60 * 24 * 90, // 90 days
} as const

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

export const server = {
  events: {
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
  },

  jobs: {
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
  },

  auth: {
    login: defineAction({
      accept: "form",
      input: z.object({
        identifier: z.email("Bitte gültige E-Mail eingeben."),
        password: z.string().min(1, "Bitte Passwort eingeben."),
        redirect: z.string().optional(),
      }),
      handler: async ({ identifier, password, redirect }, context) => {
        const res = await fetch(`${strapiUrl}/api/auth/local`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new ActionError({
            code: "UNAUTHORIZED",
            message: data?.error?.message ?? "Anmeldung fehlgeschlagen.",
          })
        }

        context.cookies.set("auth_token", data.jwt, { ...COOKIE_OPTS, httpOnly: true })
        context.cookies.set(
          "auth_user",
          JSON.stringify({ username: data.user.username, email: data.user.email }),
          COOKIE_OPTS
        )

        return { username: data.user.username, redirect: redirect || "/" }
      },
    }),

    getMe: defineAction({
      handler: async (_input, context) => {
        const token = context.cookies.get("auth_token")?.value
        if (!token) {
          throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
        }

        const res = await fetch(`${strapiUrl}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!res.ok) {
          throw new ActionError({ code: "UNAUTHORIZED", message: "Sitzung abgelaufen." })
        }

        return res.json() as Promise<{
          id: number
          username: string
          email: string
          createdAt: string
        }>
      },
    }),

    register: defineAction({
      accept: "form",
      input: z
        .object({
          email: z.email("Bitte gültige E-Mail eingeben."),
          password: z.string().min(10, "Passwort muss mindestens 10 Zeichen haben."),
          passwordConfirm: z.string(),
        })
        .refine((d) => d.password === d.passwordConfirm, {
          message: "Die Passwörter stimmen nicht überein.",
          path: ["passwordConfirm"],
        }),
      handler: async ({ email, password }, context) => {
        const res = await fetch(`${strapiUrl}/api/auth/local/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, username: email, password }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: data?.error?.message ?? "Registrierung fehlgeschlagen.",
          })
        }

        context.cookies.set("auth_token", data.jwt, { ...COOKIE_OPTS, httpOnly: true })
        context.cookies.set(
          "auth_user",
          JSON.stringify({ username: data.user.username, email: data.user.email }),
          COOKIE_OPTS
        )

        return { username: data.user.username }
      },
    }),
  },
}
