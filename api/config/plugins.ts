import type { Core } from "@strapi/strapi"

const config = ({ env: _env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  "config-sync": {
    enabled: true,
    config: {
      importOnBootstrap: true,
    },
  },
})

export default config
