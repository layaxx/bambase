import type { AstroCookies } from "astro"

export const AUTH_COOKIE_OPTS = {
  path: "/",
  sameSite: "strict",
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 7,
} as const

export function setAuthCookies(cookies: AstroCookies, jwt: string, user: { email: string }) {
  cookies.set("auth_token", jwt, { ...AUTH_COOKIE_OPTS, httpOnly: true })
  cookies.set("auth_user", JSON.stringify(user), { ...AUTH_COOKIE_OPTS, httpOnly: false })
}

export function updateJwtCookie(cookies: AstroCookies, jwt: string) {
  cookies.set("auth_token", jwt, { ...AUTH_COOKIE_OPTS, httpOnly: true })
}

export function deleteAuthCookies(cookies: AstroCookies) {
  cookies.delete("auth_token", { path: "/" })
  cookies.delete("auth_user", { path: "/" })
}
