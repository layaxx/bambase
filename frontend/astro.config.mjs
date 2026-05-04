// @ts-check
import { defineConfig, envField } from "astro/config"
import tailwindcss from "@tailwindcss/vite"
import node from "@astrojs/node"
import { fileURLToPath } from "node:url"

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  },
  env: {
    schema: {
      STRAPI_URL: envField.string({
        context: "client",
        access: "public",
        default: "http://localhost:1337",
        url: true,
      }),
      STRAPI_TOKEN: envField.string({
        context: "server",
        access: "secret",
      }),
    },
  },
})
