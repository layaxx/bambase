# 14. Accessibility baseline: WCAG 2.1 AA, lint-enforced

- Status: Accepted
- Source: `eslint.config.mjs`, `src/components/Header.astro`, `src/global.css`

## Context

BITV 2.0, the legal baseline for German public-sector sites, references WCAG 2.1 AA. The site serves university students and should meet that bar.

## Decision

- The target is **WCAG 2.1 AA** for all pages.
- `eslint-plugin-jsx-a11y` runs on `.astro` files via `eslint-plugin-astro`'s `flat/jsx-a11y-recommended` config. Violations fail lint.
- Established patterns to follow:
  - A skip link to `#main-content` in `Header.astro`. Pages that use `AppLayout` directly (login, register, password pages) must put `id="main-content"` on their own `<main>`.
  - Every page has one `<h1>`. The homepage's is `sr-only` and reuses the footer tagline.
  - Radio groups are wrapped in `fieldset`/`legend`.
  - Dialogs have `aria-labelledby`.
  - Filter result counts use `aria-live="polite"`.
  - `prefers-reduced-motion` is respected globally.
- Placeholder links (`href="#"`) aren't allowed. Use a `<span>` or a real target.

## Consequences

- Contrast fixes must stay within the two-opacity rule (ADR 13). `/70` is the readable choice.
- Lint covers only static markup. Dynamic behaviour (focus management, `aria-expanded` toggles) still needs a manual check.
