import type { AstroGlobal } from "astro"
import { auth, roles, statement } from "./auth"

type Role = keyof typeof roles
export const USER_ROLES = Object.keys(roles) as [Role, ...Role[]]
type Permissions = { [K in keyof typeof statement]?: (typeof statement)[K][number][] }

async function hasPermission(
  role: string | null | undefined,
  permissions: Permissions
): Promise<boolean> {
  const result = await auth.api.userHasPermission({
    body: {
      role: (role ?? "user") as Role,
      permissions,
    },
  })
  return result.success
}

export function canModerateJobOffers(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { jobOffer: ["moderate"] })
}

export function canModerateEvents(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { event: ["moderate"] })
}

/**
 * A report has no permission of its own. To moderate a report against an event you need
 * event:moderate, and against a job you need jobOffer:moderate. `targetType` is undefined for
 * an orphan report, whose target is deleted. Each of the two moderator roles can act on those.
 */
export function canModerateReport(
  role: string | null | undefined,
  targetType: "event" | "job" | undefined
): Promise<boolean> {
  if (targetType === "event") return canModerateEvents(role)
  if (targetType === "job") return canModerateJobOffers(role)
  return canModerateAnyReports(role)
}

export async function canModerateAnyReports(role: string | null | undefined): Promise<boolean> {
  return (await canModerateJobOffers(role)) || (await canModerateEvents(role))
}

export function canManageLocations(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { location: ["manage"] })
}

export function canManageStudentGroups(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { studentGroup: ["manage"] })
}

export function canManageUsers(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { user: ["list", "ban"] })
}

export function canSetUserRoles(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { user: ["set-role"] })
}

// better-auth's adminUpdateUser requires both permissions to change `emailVerified`.
export function canVerifyUserEmails(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { user: ["update", "set-email"] })
}

export function canInviteUsers(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { user: ["create"] })
}

export function canViewSystemStatus(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { system: ["view"] })
}

type LocalUser = App.Locals["user"]

/**
 * Redirects to the login page if the user is not signed in, or to "/" if the role of the user
 * fails `check`. Callers must `return` the result if it is a `Response`.
 */
export async function requireRole(
  Astro: AstroGlobal,
  check: (role: string | null | undefined) => Promise<boolean>,
  redirectPath: string
): Promise<{ user: NonNullable<LocalUser> } | Response> {
  const user = Astro.locals.user
  if (!user) return Astro.redirect(`/login?redirect=${redirectPath}`)
  if (!(await check(user.role))) return Astro.redirect("/")
  return { user }
}
