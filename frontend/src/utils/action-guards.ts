import { ActionError } from "astro:actions"

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
 */
export async function assertOwnerOrPermission(
  context: ActionContext,
  userId: string,
  ownerId: string | null | undefined,
  check?: RoleCheck,
  message = "Keine Berechtigung."
): Promise<void> {
  if (ownerId === userId) return
  if (check && (await check(context.locals.user?.role))) return
  throw new ActionError({ code: "FORBIDDEN", message })
}
