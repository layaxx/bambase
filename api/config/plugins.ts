import type { Core } from "@strapi/strapi"

const config = ({ env: _env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  "config-sync": {
    enabled: true,
    config: {
      importOnBootstrap: true,
    },
  },
  email: {
    config: {
      provider: "strapi-provider-email-development",
    },
  },
})

export default config
