import { auth } from "./auth"

type ConfiguredRole = "user" | "moderator" | "admin"

export async function canModerateJobOffers(role: string | null | undefined): Promise<boolean> {
  const result = await auth.api.userHasPermission({
    body: {
      role: (role ?? "user") as ConfiguredRole,
      permissions: { jobOffer: ["moderate"] },
    },
  })
  return result.success
}
