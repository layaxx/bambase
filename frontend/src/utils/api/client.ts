import { strapi } from "@strapi/client"

if (import.meta.env.PROD && !import.meta.env.STRAPI_URL) {
  throw new Error("STRAPI_URL environment variable is not set")
}

export const strapiUrl = import.meta.env.STRAPI_URL ?? "http://localhost:1337"

export const client = strapi({
  baseURL: `${strapiUrl}/api`,
  auth: import.meta.env.STRAPI_TOKEN,
})
