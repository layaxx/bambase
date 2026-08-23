import { defineAction, ActionError } from "astro:actions"
import { z } from "astro/zod"
import { APIError } from "better-auth"
import { canManageUsers, canSetUserRoles, canInviteUsers, USER_ROLES } from "@/utils/authz"
import { requirePermission } from "@/utils/action-guards"
import { auth } from "@/utils/auth"

export const users = {
  ban: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().min(1),
      reason: z.string().max(500).optional(),
    }),
    handler: async ({ id, reason }, context) => {
      await requirePermission(context, canManageUsers)

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
      await requirePermission(context, canManageUsers)

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

  setRole: defineAction({
    accept: "form",
    input: z.object({
      id: z.string().min(1),
      role: z.enum(USER_ROLES),
    }),
    handler: async ({ id, role }, context) => {
      const userId = await requirePermission(context, canSetUserRoles)

      if (id === userId) {
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Du kannst deine eigene Rolle nicht ändern.",
        })
      }

      try {
        await auth.api.setRole({
          headers: context.request.headers,
          body: { userId: id, role },
        })
      } catch (error) {
        if (error instanceof APIError) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Rolle konnte nicht geändert werden.",
          })
        }
        console.error("User role change failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Rolle konnte nicht geändert werden.",
        })
      }

      return {}
    },
  }),

  invite: defineAction({
    accept: "form",
    input: z.object({
      email: z.email(),
      name: z.string().min(1).max(200),
      role: z.enum(USER_ROLES),
    }),
    handler: async ({ email, name, role }, context) => {
      await requirePermission(context, canInviteUsers)

      try {
        await auth.api.createUser({
          headers: context.request.headers,
          body: { email, name, role },
        })
      } catch (error) {
        if (error instanceof APIError) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Diese E-Mail-Adresse wird bereits verwendet.",
          })
        }
        console.error("User invite failed:", error)
        throw new ActionError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Einladung fehlgeschlagen.",
        })
      }

      try {
        await auth.api.requestPasswordReset({
          headers: context.request.headers,
          body: { email, redirectTo: "/reset-password" },
        })
      } catch (error) {
        console.error("Sending invite email failed:", error)
      }

      return {}
    },
  }),
}
