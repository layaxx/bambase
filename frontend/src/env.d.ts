/// <reference types="astro/client" />

declare module "*.astro" {
  const Component: (props: Record<string, unknown>) => AstroFactoryReturnValue
  export default Component
}

declare module "@fontsource-variable/archivo" {}
declare module "@fontsource-variable/inter" {}

declare namespace App {
  interface Locals {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    locale: import("./i18n/translations").Locale
  }
}
