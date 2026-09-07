import { ActionError } from "astro:actions"
import { Prisma } from "@/generated/prisma/client"

type ActionContext = { locals: Pick<App.Locals, "user"> }
type RoleCheck = (role: string | null | undefined) => Promise<boolean>

/** Throws UNAUTHORIZED unless the caller is signed in; returns their user id. */
export function requireUserId(context: ActionContext): string {
  const userId = context.locals.user?.id
  if (!userId) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
  return userId
}

/** Throws UNAUTHORIZED/FORBIDDEN unless the caller is signed in and passes `check`. */
export async function requirePermission(
  context: ActionContext,
  check: RoleCheck,
  message = "Keine Berechtigung."
): Promise<string> {
  const userId = requireUserId(context)
  if (!(await check(context.locals.user?.role))) {
    throw new ActionError({ code: "FORBIDDEN", message })
  }
  return userId
}

/**
 * Throws FORBIDDEN unless `userId` owns the entity, or (when given) passes `check`.
 * Used after loading an entity that may belong to its creator or be moderated by staff.
 *
 * Returns whether the caller passed `check` (i.e. acts as staff rather than as the owner), so
 * callers can treat a moderator's edit differently from an owner's — the owner of an approved
 * entity must not be able to silently change what a moderator signed off on.
 */
export async function assertOwnerOrPermission(
  context: ActionContext,
  userId: string,
  ownerId: string | null | undefined,
  check?: RoleCheck,
  message = "Keine Berechtigung."
): Promise<boolean> {
  const hasPermission = check ? await check(context.locals.user?.role) : false
  if (hasPermission) return true
  if (ownerId === userId) return false
  throw new ActionError({ code: "FORBIDDEN", message })
}

/**
 * Logs `error` and converts it to an ActionError. P2025 means the row is gone, which the write
 * itself reports — so callers need no pre-flight existence query. Any other known Prisma error
 * (bad foreign key, duplicate unique value) means the submitted data was invalid and maps to
 * BAD_REQUEST; anything else is an unexpected failure and maps to INTERNAL_SERVER_ERROR.
 */
export function mutationError(
  error: unknown,
  logLabel: string,
  message: string,
  notFoundMessage = message
): ActionError {
  console.error(`${logLabel}:`, error)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return new ActionError({ code: "NOT_FOUND", message: notFoundMessage })
    }
    return new ActionError({ code: "BAD_REQUEST", message })
  }
  return new ActionError({ code: "INTERNAL_SERVER_ERROR", message })
}
