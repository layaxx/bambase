import type { Core } from "@strapi/strapi"

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  "config-sync": {
    enabled: true,
    config: {
      importOnBootstrap: true,
    },
  },
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
})

export default config
