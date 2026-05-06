import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { STRAPI_URL } from "astro:env/client"
import { setAuthCookies } from "@/utils/auth-cookies"

export const auth = {
  login: defineAction({
    accept: "form",
    input: z.object({
      identifier: z.email("Bitte gültige E-Mail eingeben."),
      password: z.string().min(1, "Bitte Passwort eingeben."),
      redirect: z.string().optional(),
    }),
    handler: async ({ identifier, password, redirect }, context) => {
      const res = await fetch(`${STRAPI_URL}/api/auth/local`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        const message: string = data?.error?.message ?? ""
        const notConfirmed = message.toLowerCase().includes("not confirmed")
        return {
          success: false,
          notConfirmed,
          email: identifier,
          redirect: null,
        }
      }

      setAuthCookies(context.cookies, data.jwt, {
        email: data.user.email,
      })

      return {
        success: true,
        notConfirmed: false,
        redirect: redirect || "/",
      }
    },
  }),

  getMe: defineAction({
    handler: async (_input, context) => {
      const token = context.cookies.get("auth_token")?.value
      if (!token) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
      }

      const res = await fetch(`${STRAPI_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new ActionError({ code: "UNAUTHORIZED", message: "Sitzung abgelaufen." })
      }

      return res.json() as Promise<{
        id: number
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
      const res = await fetch(`${STRAPI_URL}/api/auth/local/register`, {
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

      // When email confirmation is enabled, Strapi does not return a JWT.
      // Don't set auth cookies — user must confirm first.
      if (!data.jwt) {
        return { confirmationPending: true, email }
      }

      setAuthCookies(context.cookies, data.jwt, {
        email: data.user.email,
      })

      return { confirmationPending: false, email }
    },
  }),

  resendConfirmation: defineAction({
    accept: "form",
    input: z.object({
      email: z.email("Bitte gültige E-Mail eingeben."),
    }),
    handler: async ({ email }) => {
      const res = await fetch(`${STRAPI_URL}/api/auth/send-email-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new ActionError({
          code: "BAD_REQUEST",
          message: data?.error?.message ?? "E-Mail konnte nicht gesendet werden.",
        })
      }

      return { success: true }
    },
  }),
}
