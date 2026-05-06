import { type Core } from "@strapi/strapi"
import { seed } from "./seed"

export default {
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    if (process.env.FORCE_RESET === "true") {
      if (process.env.NODE_ENV === "production") {
        strapi.log.error("FORCE_RESET is set to true in production! Aborting to prevent data loss.")
      } else {
        strapi.log.info("FORCE_RESET is set to true, resetting data...")
        await Promise.all([
          strapi.db.query("api::job-offer.job-offer").deleteMany({}),
          strapi.db.query("api::event.event").deleteMany({}),
          strapi.db.query("api::location.location").deleteMany({}),
          strapi.db.query("api::student-group.student-group").deleteMany({}),
          strapi.db.query("plugin::users-permissions.user").deleteMany({}),
        ])
      }
    }
    if (process.env.SEED === "true") {
      strapi.service("api::mensa.mensa").load()
      strapi.log.info("Starting seeding process...")
      await seed(strapi)
      strapi.log.info("Seeding process completed.")
    }

    const frontendUrl = process.env.FRONTEND_URL
    if (frontendUrl) {
      const store = strapi.store({ type: "plugin", name: "users-permissions" })
      const advanced = (await store.get({ key: "advanced" })) as Record<string, unknown>
      const newRedirection = `${frontendUrl}/login?confirmed=true`
      const newResetUrl = `${frontendUrl}/reset-password`
      if (
        advanced.email_confirmation_redirection !== newRedirection ||
        advanced.email_reset_password !== newResetUrl
      ) {
        await store.set({
          key: "advanced",
          value: {
            ...advanced,
            email_confirmation_redirection: newRedirection,
            email_reset_password: newResetUrl,
          },
        })
      }
    }
  },
}
