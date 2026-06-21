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
  "users-permissions": {
    config: {
      jwtManagement: "refresh",
      sessions: {
        accessTokenLifespan: 900, // 15 min
        maxRefreshTokenLifespan: 2592000, // 30 days
        idleRefreshTokenLifespan: 1209600, // 14 days
      },
      ratelimit: {
        interval: 60000,
        max: 100000,
      },
    },
  },
})

export default config
