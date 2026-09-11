import { defineConfig } from "prisma/config"

try {
  process.loadEnvFile()
} catch {
  // There is no .env file. Continue with the environment as it is.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --experimental-strip-types prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
})
