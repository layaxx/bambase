import type { Core } from "@strapi/strapi"

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  email: {
    config: {
      provider: "@strapi/provider-email-mailgun",
      providerOptions: {
        key: env("MAILGUN_API_KEY"),
        domain: env("MAILGUN_DOMAIN"),
        url: "https://api.eu.mailgun.net",
      },
      settings: {
        defaultFrom: "noreply@bambase.de",
        defaultReplyTo: "noreply@bambase.de",
      },
    },
  },
  "users-permissions": {
    config: {
      jwtManagement: "refresh",
      sessions: {
        accessTokenLifespan: 900, // 15 min
        maxRefreshTokenLifespan: 2592000, // 30 days
        idleRefreshTokenLifespan: 1209600, // 14 days
      },
    },
  },
})

export default config
