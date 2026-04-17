import { getViteConfig } from "astro/config"

export default getViteConfig({
  test: {
    environment: "node",
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
} as any) // eslint-disable-line @typescript-eslint/no-explicit-any
