import { Core } from "@strapi/strapi"
import { seed } from "./seed"

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (process.env.SEED === "true") {
      strapi.service("api::mensa.mensa").load()
      strapi.log.info("Starting seeding process...")
      await seed(strapi)
      strapi.log.info("Seeding process completed.")
    }
  },
}
