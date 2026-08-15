import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { APIError } from "better-auth"
import { canManageUsers } from "@/utils/authz"
import { auth } from "@/utils/auth"

async function requireUserManager(context: { locals: { user: { role?: string | null } | null } }) {
  if (!context.locals.user) {
    throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
  }
  if (!(await canManageUsers(context.locals.user.role))) {
    throw new ActionError({ code: "FORBIDDEN", message: "Keine Berechtigung." })
  }
}

export const users = {
  ban: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().min(1),
      reason: z.string().max(500).optional(),
    }),
    handler: async ({ id, reason }, context) => {
      await requireUserManager(context)

      try {
        await auth.api.banUser({
          headers: context.request.headers,
          body: { userId: id, banReason: reason || undefined },
        })
      } catch (error) {
        if (error instanceof APIError && error.status === "BAD_REQUEST") {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Du kannst dich nicht selbst sperren.",
          })
        }
        console.error("User ban failed:", error)
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Sperren fehlgeschlagen." })
      }

      return {}
    },
  }),

  unban: defineAction({
    accept: "form",
    input: z.object({ id: z.string().min(1) }),
    handler: async ({ id }, context) => {
      await requireUserManager(context)

      try {
        await auth.api.unbanUser({
          headers: context.request.headers,
          body: { userId: id },
        })
      } catch (error) {
        console.error("User unban failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Entsperren fehlgeschlagen.",
        })
      }

      return {}
    },
  }),
}
