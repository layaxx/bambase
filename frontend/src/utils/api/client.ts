import { strapi } from "@strapi/client"

export const strapiUrl = import.meta.env.STRAPI_URL ?? "http://localhost:1337"

export const client = strapi({
  baseURL: `${strapiUrl}/api`,
  auth: import.meta.env.STRAPI_TOKEN,
})
