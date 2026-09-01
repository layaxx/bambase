/* eslint-disable @typescript-eslint/consistent-type-imports */
/// <reference types="astro/client" />

declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => AstroFactoryReturnValue
  export default Component
}

declare module "@fontsource-variable/archivo" {}
declare module "@fontsource-variable/inter" {}

type UserWithRole = import("better-auth").User & { role?: string | null }

declare namespace App {
  interface Locals {
    locale: import("./i18n/translations").Locale
    user: UserWithRole | null
    session: import("better-auth").Session | null
  }
}
