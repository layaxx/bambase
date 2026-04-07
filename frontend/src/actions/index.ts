import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { strapiUrl } from "../utils/api"

const COOKIE_OPTS = {
  path: "/",
  httpOnly: false, // readable by server-side Astro, not by client JS for auth_user display
  sameSite: "strict",
  maxAge: 60 * 60 * 24 * 90, // 90 days
} as const

export const server = {
  auth: {
    login: defineAction({
      accept: "form",
      input: z.object({
        identifier: z.email("Bitte gültige E-Mail eingeben."),
        password: z.string().min(1, "Bitte Passwort eingeben."),
      }),
      handler: async ({ identifier, password }, context) => {
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

        return { username: data.user.username }
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

        return res.json() as Promise<{ username: string; email: string; createdAt: string }>
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
