/* eslint-disable @typescript-eslint/consistent-type-imports */
/// <reference types="astro/client" />

declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => AstroFactoryReturnValue
  export default Component
}

declare module "@fontsource-variable/archivo" {}
declare module "@fontsource-variable/inter" {}

declare namespace App {
  interface Locals {
    locale: import("./i18n/translations").Locale
    user: { id: number; email?: string; createdAt?: string } | null
    token: string | null
    userNew: import("better-auth").User | null
    session: import("better-auth").Session | null
  }
}
