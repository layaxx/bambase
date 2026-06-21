import type { AstroCookies } from "astro"

const THIRTY_DAYS = 60 * 60 * 24 * 30

export const AUTH_COOKIE_OPTS = {
  path: "/",
  sameSite: "strict",
  secure: import.meta.env.PROD,
  maxAge: THIRTY_DAYS,
} as const

const REFRESH_COOKIE_OPTS = {
  path: "/",
  sameSite: "strict",
  secure: import.meta.env.PROD,
  httpOnly: true,
  maxAge: THIRTY_DAYS,
} as const

export function setAuthCookies(
  cookies: AstroCookies,
  jwt: string,
  user: { email: string },
  refreshToken?: string
) {
  cookies.set("auth_token", jwt, { ...AUTH_COOKIE_OPTS, httpOnly: true })
  cookies.set("auth_user", JSON.stringify(user), { ...AUTH_COOKIE_OPTS, httpOnly: false })
  if (refreshToken) {
    cookies.set("refresh_token", refreshToken, REFRESH_COOKIE_OPTS)
  }
}

export function updateJwtCookie(cookies: AstroCookies, jwt: string) {
  cookies.set("auth_token", jwt, { ...AUTH_COOKIE_OPTS, httpOnly: true })
}

export function updateRefreshTokenCookie(cookies: AstroCookies, refreshToken: string) {
  cookies.set("refresh_token", refreshToken, REFRESH_COOKIE_OPTS)
}

export function deleteAuthCookies(cookies: AstroCookies) {
  cookies.delete("auth_token", { path: "/" })
  cookies.delete("auth_user", { path: "/" })
  cookies.delete("refresh_token", { path: "/" })
}
