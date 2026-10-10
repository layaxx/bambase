# 13. Styling: semantic color tokens only, two text-opacity levels

- Status: Accepted
- Source: `src/global.css`, `eslint-rules/`

## Context

Hardcoded Tailwind palette classes and hex values broke dark mode. On top of that, many arbitrary opacity values made the text hierarchy inconsistent.

## Decision

- The DaisyUI `light`/`dark` themes are used, with their semantic colors (`primary`, `secondary`, `accent`, `info`, `success`, `warning`, `error`) remapped in `global.css`. They are set on `:root` and again under `[data-theme="dark"]` with lighter shades. **This file is the only place where Tailwind palette colors are chosen.**
- Components use **semantic classes** (`text-primary`, `badge-soft badge-success`, …), never palette classes like `bg-green-100` or raw hex.
- Location category colors (`--cat-*`) are aliases for the semantic colors, so they follow the theme automatically.
- Leaflet popup HTML can't use classes, so it uses `--popup-*` variables defined in `map.astro` with light and dark values.
- Text opacity has two levels: `text-base-content/70` (secondary) and `/40` (muted). The `local/no-banned-opacity` ESLint rule enforces this.
- Homepage section icons each use a distinct semantic color (`badge-soft badge-*`): events `primary`, mensa `warning`, jobs `success`, map `info`, groups `secondary`. New sections pick an unused one.
- Theme: an explicit choice in `localStorage` wins. Otherwise `prefers-color-scheme` decides (`AppLayout.astro`).
- SVG icons live only in `src/components/icons/`. The `local/no-inline-svg` rule enforces this.

## Consequences

- Changing the palette means editing both theme blocks in `global.css` and checking contrast in both themes.
- Any other new color is a semantic class or a new CSS variable with light and dark values.
