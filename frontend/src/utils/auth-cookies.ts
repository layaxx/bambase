import type { AstroCookies } from "astro"

const BASE_OPTS = {
  path: "/",
  sameSite: "strict",
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 7,
} as const

export function setAuthCookies(cookies: AstroCookies, jwt: string, user: { email: string }) {
  cookies.set("auth_token", jwt, { ...BASE_OPTS, httpOnly: true })
  cookies.set("auth_user", JSON.stringify(user), { ...BASE_OPTS, httpOnly: false })
}
