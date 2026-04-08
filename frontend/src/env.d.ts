/// <reference types="astro/client" />

declare module "@fontsource-variable/archivo" {}
declare module "@fontsource-variable/inter" {}

declare namespace App {
  interface Locals {
    locale: import("./i18n/translations").Locale
  }
}
