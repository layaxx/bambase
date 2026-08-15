import { auth } from "./auth"

type ConfiguredRole = "user" | "moderator" | "admin"
type UserAction =
  | "create"
  | "list"
  | "set-role"
  | "ban"
  | "impersonate"
  | "impersonate-admins"
  | "delete"
  | "set-password"
  | "set-email"
  | "get"
  | "update"
type SessionAction = "list" | "revoke" | "delete"
type Permissions = {
  jobOffer?: "moderate"[]
  event?: "moderate"[]
  user?: UserAction[]
  session?: SessionAction[]
}

async function hasPermission(
  role: string | null | undefined,
  permissions: Permissions
): Promise<boolean> {
  const result = await auth.api.userHasPermission({
    body: {
      role: (role ?? "user") as ConfiguredRole,
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

export function canManageUsers(role: string | null | undefined): Promise<boolean> {
  return hasPermission(role, { user: ["list", "ban"] })
}
