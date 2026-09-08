import { ActionError } from "astro:actions"
import { Prisma } from "@/generated/prisma/client"

type ActionContext = { locals: Pick<App.Locals, "user"> }
type RoleCheck = (role: string | null | undefined) => Promise<boolean>

/** Returns the id of the caller. Throws UNAUTHORIZED if the caller is not signed in. */
export function requireUserId(context: ActionContext): string {
  const userId = context.locals.user?.id
  if (!userId) throw new ActionError({ code: "UNAUTHORIZED", message: "Nicht angemeldet." })
  return userId
}

/**
 * Returns the id of the caller. Throws UNAUTHORIZED if the caller is not signed in,
 * or FORBIDDEN if the caller fails `check`.
 */
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
 * Throws FORBIDDEN if `userId` is not the owner of the entity and the caller fails `check`.
 * Use this function after you load an entity that its creator owns and that staff can moderate.
 *
 * Returns true if the caller passed `check` and thus acts as staff, and not as the owner.
 * Callers use this result to make the edit of a moderator different from the edit of an owner.
 * The owner of an approved entity must not change the content that a moderator approved.
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
 * Logs `error` and converts it to an ActionError.
 * P2025 means that the row is gone. The write itself reports this, thus callers need no
 * preliminary query for the row. Each other known Prisma error (a bad foreign key or a
 * duplicate unique value) means that the data is not valid, and becomes BAD_REQUEST.
 * Each other error is an unexpected failure, and becomes INTERNAL_SERVER_ERROR.
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
