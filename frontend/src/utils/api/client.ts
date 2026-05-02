import { strapi } from "@strapi/client"

if (import.meta.env.PROD && !process.env.STRAPI_URL) {
  throw new Error("STRAPI_URL environment variable is not set")
}

export const strapiUrl = process.env.STRAPI_URL ?? "http://localhost:1337"

export const client = strapi({
  baseURL: `${strapiUrl}/api`,
  auth: process.env.STRAPI_TOKEN,
})
