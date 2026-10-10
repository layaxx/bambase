# 5. Web fonts via the Astro fonts API

- Status: Accepted
- Source: `astro.config.mjs`, `src/layouts/AppLayout.astro`

## Context

Fonts used to be loaded with bare `@fontsource-variable/*` CSS imports. That gave no preload hints and shipped the full variable Archivo font, although only one weight is used.

## Decision

Use Astro's `fonts` config with `fontProviders.fontsource()`:

- **Inter**: variable font, `weights: ["100 900"]`, exposed as `--font-inter`. This is the body font (`--font-sans` in `global.css`).
- **Archivo**: static weight 800 only, exposed as `--font-archivo`. It is used only for the logo (`.logo-font`).

The layout renders `<Font cssVariable=… preload />`, which emits the preload links and `@font-face` rules. Astro's default `font-display: swap` is kept.

## Consequences

- Archivo shrank from 35 KB to 15 KB. If you need a new Archivo weight, add it to `weights`. Don't switch back to the variable font without a reason.
- Don't add `@fontsource*` CSS imports. The one remaining fontsource package is for OG image rendering only (ADR 4).
