import { strapi } from "@strapi/client"
import { STRAPI_URL } from "astro:env/client"
import { STRAPI_TOKEN } from "astro:env/server"

export const client = strapi({
  baseURL: `${STRAPI_URL}/api`,
  auth: STRAPI_TOKEN,
})
