import { strapi } from "@strapi/client"
import { STRAPI_URL } from "astro:env/client"
import { STRAPI_TOKEN } from "astro:env/server"

export const client = strapi({
  baseURL: `${STRAPI_URL}/api`,
  auth: STRAPI_TOKEN,
})

export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Request timed out")), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  ms = 8000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}
